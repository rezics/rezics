import { createHash } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import {
	UnitMergeKindIneligible,
	UnitMergeKindMismatch,
	UnitMergeManifestStale,
	UnitMergeRequestConflict,
} from "../../api/governance/errors";
import type { DatabaseTransaction } from "../../database";
import {
	type UnitMergeEligibleKind,
	UnitMergeEligibleKindValues,
	unit,
	unitMergeGraphGuard,
	unitMergeRedirect,
	unitVariant,
	type UnitMergeGraphPlanV1,
} from "../../database/schema";
import { UnitNotFound } from "../errors";
import { UnitMergePolicyV1 } from "./policy";

const EligibleKinds: ReadonlySet<string> = new Set(UnitMergeEligibleKindValues);

function isUnitMergeEligibleKind(value: string): value is UnitMergeEligibleKind {
	return EligibleKinds.has(value);
}

type LockedMergeUnit = {
	readonly id: string;
	readonly kind: string;
	readonly deletedAt: Date | null;
	readonly updatedAt: Date;
};

export type UnitMergeManifestV1 = {
	readonly version: 1;
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly unitKind: UnitMergeEligibleKind;
	readonly sourceUpdatedAt: Date;
	readonly targetUpdatedAt: Date;
	readonly sourceGraphRevision: number;
	readonly targetGraphRevision: number;
	readonly graphPlan: UnitMergeGraphPlanV1;
	readonly requestFingerprint: string;
};

async function lockMergeUnits(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	targetUnitId: string,
): Promise<readonly [LockedMergeUnit, LockedMergeUnit]> {
	if (sourceUnitId === targetUnitId) throw new UnitMergeRequestConflict();
	const ids = [sourceUnitId, targetUnitId].sort();
	for (const unitId of ids)
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended('unit-merge:' || ${unitId}::text, 0))`,
		);
	const rows = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			deletedAt: unit.deletedAt,
			updatedAt: unit.updatedAt,
		})
		.from(unit)
		.where(inArray(unit.id, ids))
		.orderBy(unit.id)
		.for("update");
	const source = rows.find((row) => row.id === sourceUnitId);
	const target = rows.find((row) => row.id === targetUnitId);
	if (!source || !target || source.deletedAt || target.deletedAt) throw new UnitNotFound();
	return [source, target];
}

async function requireUnmergedPair(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	targetUnitId: string,
): Promise<void> {
	const redirects = await tx
		.select({ sourceUnitId: unitMergeRedirect.sourceUnitId })
		.from(unitMergeRedirect)
		.where(inArray(unitMergeRedirect.sourceUnitId, [sourceUnitId, targetUnitId]))
		.limit(2);
	if (redirects.length) throw new UnitMergeRequestConflict();
}

async function graphRevision(tx: DatabaseTransaction, unitId: string): Promise<number> {
	await tx.insert(unitMergeGraphGuard).values({ unitId }).onConflictDoNothing();
	const [guard] = await tx
		.select({ revision: unitMergeGraphGuard.revision })
		.from(unitMergeGraphGuard)
		.where(eq(unitMergeGraphGuard.unitId, unitId))
		.limit(1);
	return guard?.revision ?? 0;
}

type GraphObservation = {
	readonly role: "standalone" | "variant" | "main";
	readonly mainUnitId: string | null;
};

async function observeGraph(tx: DatabaseTransaction, unitId: string): Promise<GraphObservation> {
	const [outbound] = await tx
		.select({ mainUnitId: unitVariant.mainUnitId })
		.from(unitVariant)
		.where(eq(unitVariant.variantUnitId, unitId))
		.limit(1);
	if (outbound) return { role: "variant", mainUnitId: outbound.mainUnitId };
	const [inbound] = await tx
		.select({ variantUnitId: unitVariant.variantUnitId })
		.from(unitVariant)
		.where(eq(unitVariant.mainUnitId, unitId))
		.limit(1);
	return inbound ? { role: "main", mainUnitId: null } : { role: "standalone", mainUnitId: null };
}

export function planUnitMergeGraph(input: {
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly source: GraphObservation;
	readonly target: GraphObservation;
}): UnitMergeGraphPlanV1 {
	let action: UnitMergeGraphPlanV1["action"] = "none";
	let destinationMainUnitId: string | null = null;
	if (input.source.role === "main") {
		if (input.target.role === "variant" && input.target.mainUnitId === input.sourceUnitId) {
			action = "promote_target_from_source";
			destinationMainUnitId = input.targetUnitId;
		} else if (input.target.role === "variant" && input.target.mainUnitId) {
			action = "reparent_source_variants_to_target_main";
			destinationMainUnitId = input.target.mainUnitId;
		} else {
			action = "reparent_source_variants_to_target";
			destinationMainUnitId = input.targetUnitId;
		}
	} else if (input.source.role === "variant") action = "detach_source";
	return {
		version: 1,
		sourceRole: input.source.role,
		targetRole: input.target.role,
		sourceMainUnitId: input.source.mainUnitId,
		targetMainUnitId: input.target.mainUnitId,
		destinationMainUnitId,
		action,
	};
}

function fingerprintManifest(manifest: Omit<UnitMergeManifestV1, "requestFingerprint">): string {
	return createHash("sha256")
		.update(
			JSON.stringify({
				version: manifest.version,
				policyVersion: UnitMergePolicyV1.version,
				sourceUnitId: manifest.sourceUnitId,
				targetUnitId: manifest.targetUnitId,
				unitKind: manifest.unitKind,
				sourceUpdatedAt: manifest.sourceUpdatedAt.toISOString(),
				targetUpdatedAt: manifest.targetUpdatedAt.toISOString(),
				sourceGraphRevision: manifest.sourceGraphRevision,
				targetGraphRevision: manifest.targetGraphRevision,
				graphPlan: manifest.graphPlan,
			}),
		)
		.digest("hex");
}

export async function buildUnitMergeManifest(
	tx: DatabaseTransaction,
	input: {
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly expectedSourceUpdatedAt?: Date;
		readonly expectedTargetUpdatedAt?: Date;
	},
): Promise<UnitMergeManifestV1> {
	const [source, target] = await lockMergeUnits(tx, input.sourceUnitId, input.targetUnitId);
	await requireUnmergedPair(tx, source.id, target.id);
	if (!isUnitMergeEligibleKind(source.kind)) throw new UnitMergeKindIneligible();
	if (!isUnitMergeEligibleKind(target.kind)) throw new UnitMergeKindIneligible();
	if (source.kind !== target.kind) throw new UnitMergeKindMismatch();
	if (
		(input.expectedSourceUpdatedAt &&
			source.updatedAt.getTime() !== input.expectedSourceUpdatedAt.getTime()) ||
		(input.expectedTargetUpdatedAt &&
			target.updatedAt.getTime() !== input.expectedTargetUpdatedAt.getTime())
	)
		throw new UnitMergeManifestStale();

	// A transaction owns one PostgreSQL client, so these independent reads remain sequential.
	const sourceGraphRevision = await graphRevision(tx, source.id);
	const targetGraphRevision = await graphRevision(tx, target.id);
	const sourceGraph = await observeGraph(tx, source.id);
	const targetGraph = await observeGraph(tx, target.id);
	const manifestWithoutFingerprint = {
		version: 1 as const,
		sourceUnitId: source.id,
		targetUnitId: target.id,
		unitKind: source.kind,
		sourceUpdatedAt: source.updatedAt,
		targetUpdatedAt: target.updatedAt,
		sourceGraphRevision,
		targetGraphRevision,
		graphPlan: planUnitMergeGraph({
			sourceUnitId: source.id,
			targetUnitId: target.id,
			source: sourceGraph,
			target: targetGraph,
		}),
	};
	return {
		...manifestWithoutFingerprint,
		requestFingerprint: fingerprintManifest(manifestWithoutFingerprint),
	};
}

export async function requireCurrentUnitMergeManifest(
	tx: DatabaseTransaction,
	stored: Pick<UnitMergeManifestV1, "sourceUnitId" | "targetUnitId" | "requestFingerprint">,
): Promise<UnitMergeManifestV1> {
	const current = await buildUnitMergeManifest(tx, {
		sourceUnitId: stored.sourceUnitId,
		targetUnitId: stored.targetUnitId,
	});
	if (current.requestFingerprint !== stored.requestFingerprint) throw new UnitMergeManifestStale();
	return current;
}
