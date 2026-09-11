import { createHash } from "node:crypto";
import { and, inArray, sql } from "drizzle-orm";
import { CatalogReferenceSchema } from "@rezics/reference";
import type { Authorization } from "../../authorization";
import type { DatabaseTransaction } from "../../database";
import {
	authEntity,
	entityParticipation,
	unitMergeGraphLock,
	unitMergeRedirect,
	participationGrant,
} from "../../database/schema";
import {
	UnitMergeKindIneligible,
	UnitMergeKindMismatch,
	UnitMergeManifestStale,
	UnitMergeRequestConflict,
} from "../../api/governance/errors";
import { readUnitStateById, type UnitState } from "../query";
import { readUnitPresentationsInTransaction } from "../presentation-reader";
import {
	loadCatalogIdentity,
	CatalogAccessDenied,
	CatalogReferenceNotFound,
} from "../../catalog/storage";
import {
	ParticipationDenied,
	currentParticipationAuthority,
	runWithParticipationAuthority,
	requireParticipation,
} from "../../participation/policy";
import { UnitNotFound } from "../errors";
import {
	MergePlanSchema,
	MergeManifestSchema,
	type MergeReadGrantsSchema,
	type DefaultMergePlan,
} from "./contracts";
import type { z } from "zod";
export type UnitMergeManifest = z.output<typeof MergeManifestSchema>;
export function mergeFingerprint(value: Omit<UnitMergeManifest, "fingerprint">) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function compatibleMergeIdentities(
	source: Pick<
		UnitState,
		"shape" | "reference" | "status" | "visibility" | "contentRating" | "moderationStatus"
	>,
	target: Pick<
		UnitState,
		"shape" | "reference" | "status" | "visibility" | "contentRating" | "moderationStatus"
	>,
) {
	return (
		source.reference.owner === target.reference.owner &&
		source.shape === target.shape &&
		source.status === target.status &&
		source.status !== "archived" &&
		source.visibility === target.visibility &&
		source.contentRating === target.contentRating &&
		source.moderationStatus === "approved" &&
		target.moderationStatus === "approved"
	);
}
export async function lockMergePair(tx: DatabaseTransaction, ids: readonly string[]) {
	for (const id of [...new Set(ids)].sort())
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended('unit-merge:'||${id}::text,0))`,
		);
}
export async function buildUnitMergeManifest(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	input: {
		sourceUnitId: string;
		targetUnitId: string;
		plan: typeof DefaultMergePlan;
		operationId?: string;
	},
	access: "write" | "read" = "write",
	readGrants?: z.output<typeof MergeReadGrantsSchema>,
): Promise<UnitMergeManifest> {
	if (input.sourceUnitId === input.targetUnitId) throw new UnitMergeRequestConflict();
	await lockMergePair(tx, [input.sourceUnitId, input.targetUnitId]);
	const rows: UnitState[] = [];
	for (const id of [input.sourceUnitId, input.targetUnitId].sort()) {
		const row = await readUnitStateById(tx, id, { lock: "update" });
		if (!row) throw new UnitNotFound();
		rows.push(row);
	}
	const source = rows.find((row) => row.id === input.sourceUnitId),
		target = rows.find((row) => row.id === input.targetUnitId);
	if (!source || !target) throw new UnitNotFound();
	const sourceReference = CatalogReferenceSchema.safeParse(source.reference),
		targetReference = CatalogReferenceSchema.safeParse(target.reference);
	if (!sourceReference.success || !targetReference.success) throw new UnitMergeKindIneligible();
	if (access !== "read" && readGrants)
		throw new ParticipationDenied("Read selections cannot authorize merge writes");
	const authority = currentParticipationAuthority();
	for (const [side, reference] of [
		["source", sourceReference.data],
		["target", targetReference.data],
	] as const) {
		try {
			const grant = readGrants?.[side];
			if (grant) {
				if (
					!authority ||
					authority.principal.kind !== "auth" ||
					authority.principal.authUserId !== authorization.authUserId
				)
					throw new ParticipationDenied("Merge read selections require the current human account");
				const selectedAuthority = { ...authority, actingEntityId: authorization.profileId, grant };
				await runWithParticipationAuthority(selectedAuthority, async () => {
					await requireParticipation(tx, selectedAuthority, "catalog.read", reference);
					return loadCatalogIdentity(tx, reference, authority.principal.authUserId, false);
				});
			} else await loadCatalogIdentity(tx, reference, authorization.authUserId ?? null, false);
		} catch (cause) {
			if (cause instanceof CatalogAccessDenied || cause instanceof CatalogReferenceNotFound)
				throw new UnitNotFound();
			throw cause;
		}
	}
	if (!compatibleMergeIdentities(source, target)) throw new UnitMergeKindMismatch();
	if (access === "write")
		for (const reference of [sourceReference.data, targetReference.data]) {
			try {
				await loadCatalogIdentity(tx, reference, authorization.authUserId ?? null, true);
			} catch (cause) {
				if (cause instanceof CatalogAccessDenied) throw new ParticipationDenied();
				throw cause;
			}
		}
	const ids = [source.id, target.id];
	const controls = await tx
		.select({ id: entityParticipation.entityId })
		.from(entityParticipation)
		.where(inArray(entityParticipation.entityId, ids))
		.limit(2);
	const selves = await tx
		.select({ id: authEntity.entityId })
		.from(authEntity)
		.where(inArray(authEntity.entityId, ids))
		.limit(2);
	const redirects = await tx
		.select({ id: unitMergeRedirect.sourceUnitId })
		.from(unitMergeRedirect)
		.where(inArray(unitMergeRedirect.sourceUnitId, ids))
		.limit(2);
	const locks = await tx
		.select({ id: unitMergeGraphLock.unitId, operationId: unitMergeGraphLock.operationId })
		.from(unitMergeGraphLock)
		.where(inArray(unitMergeGraphLock.unitId, ids))
		.limit(2);
	if (controls.length || selves.length) throw new UnitMergeKindIneligible();
	if (redirects.length || locks.some((lock) => lock.operationId !== input.operationId))
		throw new UnitMergeRequestConflict();
	const labels = await readUnitPresentationsInTransaction(tx, ids);
	const selectedReadGrantIds = [
		...new Set(
			[readGrants?.source?.id, readGrants?.target?.id].filter(
				(id): id is string => id !== undefined,
			),
		),
	];
	if (selectedReadGrantIds.length) {
		// Row locks prevent revocation, but a wait on the other side can outlive a deadline.
		const [expired] = await tx
			.select({ id: participationGrant.id })
			.from(participationGrant)
			.where(
				and(
					inArray(participationGrant.id, selectedReadGrantIds),
					sql`${participationGrant.expiresAt} <= statement_timestamp()`,
				),
			)
			.limit(1);
		if (expired) throw new ParticipationDenied("Private merge read selection expired");
	}
	const partial = {
		owner: sourceReference.data.owner,
		shape: source.shape,
		sourceUnit: { id: source.id, title: labels.get(source.id)?.title ?? null },
		targetUnit: { id: target.id, title: labels.get(target.id)?.title ?? null },
		sourceRevision: source.revision,
		targetRevision: target.revision,
		sourceUpdatedAt: source.updatedAt.toISOString(),
		targetUpdatedAt: target.updatedAt.toISOString(),
		status: source.status,
		visibility: source.visibility,
		plan: MergePlanSchema.parse(input.plan),
	};
	return MergeManifestSchema.parse({ ...partial, fingerprint: mergeFingerprint(partial) });
}
export function assertMergeManifestFingerprint(actual: UnitMergeManifest, expected: string) {
	if (actual.fingerprint !== expected) throw new UnitMergeManifestStale();
}
