import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unit, unitVariant } from "../database/schema";
import { UnitNotFound, UnitVariantMainUnavailable } from "./errors";

type UnitLifecycleState = {
	readonly status: string;
	readonly visibility: string;
	readonly moderationStatus: string;
	readonly deletedAt: Date | null;
};

export function isDiscoverableVariantUnit(state: UnitLifecycleState): boolean {
	return (
		state.status === "published" &&
		state.visibility === "public" &&
		state.moderationStatus === "approved" &&
		state.deletedAt === null
	);
}

/** Validate relationship availability after an ordinary lifecycle mutation. */
export async function ensureUnitVariantLifecycle(
	tx: DatabaseTransaction,
	unitId: string,
): Promise<void> {
	const [current] = await tx
		.select({
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!current) throw new UnitNotFound();

	const [outbound] = await tx
		.select({
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
			deletedAt: unit.deletedAt,
		})
		.from(unitVariant)
		.innerJoin(unit, eq(unit.id, unitVariant.mainUnitId))
		.where(eq(unitVariant.variantUnitId, unitId))
		.limit(1);
	if (outbound && isDiscoverableVariantUnit(current) && !isDiscoverableVariantUnit(outbound))
		throw new UnitVariantMainUnavailable();

	if (current.deletedAt) {
		const [remainingVariant] = await tx
			.select({ id: unitVariant.variantUnitId })
			.from(unitVariant)
			.innerJoin(unit, eq(unit.id, unitVariant.variantUnitId))
			.where(and(eq(unitVariant.mainUnitId, unitId), isNull(unit.deletedAt)))
			.limit(1);
		if (remainingVariant) throw new UnitVariantMainUnavailable();
		return;
	}
	if (isDiscoverableVariantUnit(current)) return;
	const [discoverableVariant] = await tx
		.select({ id: unitVariant.variantUnitId })
		.from(unitVariant)
		.innerJoin(unit, eq(unit.id, unitVariant.variantUnitId))
		.where(
			and(
				eq(unitVariant.mainUnitId, unitId),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (discoverableVariant) throw new UnitVariantMainUnavailable();
}
