import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { CatalogReferenceSchema } from "@rezics/reference";
import type { Authorization } from "../../authorization";
import type { DatabaseTransaction } from "../../database";
import {
	authEntity,
	entityParticipation,
	unitMergeGraphLock,
	unitMergeRedirect,
} from "../../database/schema";
import {
	UnitMergeKindIneligible,
	UnitMergeKindMismatch,
	UnitMergeManifestStale,
	UnitMergeRequestConflict,
} from "../../api/governance/errors";
import { readUnitStateById, type UnitState } from "../query";
import { readUnitPresentationsInTransaction } from "../presentation-reader";
import { UnitNotFound } from "../errors";
import { MergePlanSchema, MergeManifestSchema, type DefaultMergePlan } from "./contracts";
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
	if (!compatibleMergeIdentities(source, target)) throw new UnitMergeKindMismatch();
	for (const id of [source.id, target.id]) {
		await authorization.unit.ensureInTransaction(tx, id, "unit.read");
		await authorization.unit.ensureInTransaction(tx, id, "unit.update");
	}
	const ids = [source.id, target.id];
	const [controls, selves, redirects, locks] = await Promise.all([
		tx
			.select({ id: entityParticipation.entityId })
			.from(entityParticipation)
			.where(inArray(entityParticipation.entityId, ids))
			.limit(2),
		tx
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.where(inArray(authEntity.entityId, ids))
			.limit(2),
		tx
			.select({ id: unitMergeRedirect.sourceUnitId })
			.from(unitMergeRedirect)
			.where(inArray(unitMergeRedirect.sourceUnitId, ids))
			.limit(2),
		tx
			.select({ id: unitMergeGraphLock.unitId, operationId: unitMergeGraphLock.operationId })
			.from(unitMergeGraphLock)
			.where(inArray(unitMergeGraphLock.unitId, ids))
			.limit(2),
	]);
	if (controls.length || selves.length) throw new UnitMergeKindIneligible();
	if (redirects.length || locks.some((lock) => lock.operationId !== input.operationId))
		throw new UnitMergeRequestConflict();
	const labels = await readUnitPresentationsInTransaction(tx, ids);
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
