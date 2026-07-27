import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { UnitAuthorization } from "../authorization/unit/authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import {
	series,
	seriesRelease,
	unit,
	unitLocalization,
	unitVariant,
	type VariantCapableUnitKind,
	VariantCapableUnitKindValues,
} from "../database/schema";
import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import { isPrimaryUnitLocalization, firstUnitLocalizationCoverAssetId } from "./localization";
import {
	UnitNotFound,
	UnitVariantChanged,
	UnitVariantKindMismatch,
	UnitVariantMainUnavailable,
	UnitVariantSourceHasVariants,
	UnitVariantTargetIsVariant,
} from "./errors";
import { recordUnitRevision } from "./history";
import { isDiscoverableVariantUnit } from "./variant-policy";

const VariantCapableUnitKinds: ReadonlySet<string> = new Set(VariantCapableUnitKindValues);

export function isVariantCapableUnitKind(value: string): value is VariantCapableUnitKind {
	return VariantCapableUnitKinds.has(value);
}

export function toUnitVariantConstraintError(error: unknown) {
	const constraint = databaseConstraintName(error);
	if (
		constraint === "unit_variant_variant_kind_fkey" ||
		constraint === "unit_variant_main_kind_fkey" ||
		constraint === "unit_variant_kind_check"
	)
		return new UnitVariantKindMismatch();
	if (
		constraint === "unit_variant_target_is_variant" ||
		constraint === "unit_variant_not_self_check"
	)
		return new UnitVariantTargetIsVariant();
	if (constraint === "unit_variant_source_has_variants")
		return new UnitVariantSourceHasVariants();
	return undefined;
}

export type UnitVariantSummary = {
	readonly id: string;
	readonly type: VariantCapableUnitKind;
	readonly title: string | null;
	readonly cover: { readonly id: string; readonly url: string } | null;
};

export type UnitVariantContext =
	| { readonly role: "standalone" }
	| { readonly role: "main"; readonly variants: UnitVariantSummary[] }
	| {
			readonly role: "variant";
			readonly relationUpdatedAt: Date;
			readonly main:
				| { readonly state: "available"; readonly unit: UnitVariantSummary }
				| { readonly state: "unavailable" };
	  };

export type UnitSeriesMembership = {
	readonly series: {
		readonly id: string;
		readonly title: string | null;
		readonly cover: { readonly id: string; readonly url: string } | null;
	};
	readonly releaseUnitId: string;
	readonly position: string;
	readonly releasedOn: string | null;
	readonly source: "direct" | "main";
};

export type UnitVariantMutationResult = {
	readonly variantUnitId: string;
	readonly mainUnitId: string | null;
	readonly changed: boolean;
};

export type UnitVariantPromotionResult = {
	readonly oldMainUnitId: string;
	readonly newMainUnitId: string;
	readonly affectedUnitIds: readonly string[];
};

type StoredUnit = {
	readonly id: string;
	readonly kind: string;
	readonly status: string;
	readonly visibility: string;
	readonly moderationStatus: string;
	readonly deletedAt: Date | null;
};

async function lockUnits(
	tx: DatabaseTransaction,
	unitIds: readonly string[],
): Promise<readonly StoredUnit[]> {
	const ids = [...new Set(unitIds)].sort();
	if (!ids.length) return [];
	return tx
		.select({
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(inArray(unit.id, ids))
		.orderBy(unit.id)
		.for("update");
}

async function lockVariantGroups(
	tx: DatabaseTransaction,
	unitIds: readonly (string | null | undefined)[],
): Promise<void> {
	const ids = [...new Set(unitIds.filter((unitId): unitId is string => Boolean(unitId)))].sort();
	for (const unitId of ids)
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${unitId}::text, 1))`);
}

function requireVariantPair(
	units: readonly StoredUnit[],
	variantUnitId: string,
	mainUnitId: string,
	expectedKind: VariantCapableUnitKind,
) {
	if (variantUnitId === mainUnitId) throw new UnitVariantTargetIsVariant();
	const variant = units.find(({ id }) => id === variantUnitId);
	const main = units.find(({ id }) => id === mainUnitId);
	if (!variant || variant.deletedAt || !main || main.deletedAt) throw new UnitNotFound();
	if (
		!isVariantCapableUnitKind(variant.kind) ||
		!isVariantCapableUnitKind(main.kind) ||
		variant.kind !== expectedKind ||
		main.kind !== expectedKind
	)
		throw new UnitVariantKindMismatch();
	return { variant, main };
}

async function ensureTargetReadable(
	tx: DatabaseTransaction,
	authorization: UnitAuthorization<string>,
	mainUnitId: string,
) {
	const decision = await authorization.decideInTransaction(tx, mainUnitId, "unit.read");
	if (!decision.allowed) throw new UnitNotFound();
}

async function storedMainUnitId(
	executor: DatabaseExecutor,
	variantUnitId: string,
): Promise<string | null> {
	const [relationship] = await executor
		.select({ mainUnitId: unitVariant.mainUnitId })
		.from(unitVariant)
		.where(eq(unitVariant.variantUnitId, variantUnitId))
		.limit(1);
	return relationship?.mainUnitId ?? null;
}

export async function resolveMainUnitId(
	executor: DatabaseExecutor,
	unitId: string,
): Promise<string> {
	return (await storedMainUnitId(executor, unitId)) ?? unitId;
}

async function readableSummaries(
	unitIds: readonly string[],
	profileId?: string,
): Promise<Map<string, UnitVariantSummary>> {
	const ids = [...new Set(unitIds)];
	if (!ids.length) return new Map();
	const rows = await database
		.select({
			id: unit.id,
			type: unit.kind,
			title: unitLocalization.title,
			coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
		})
		.from(unit)
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), isPrimaryUnitLocalization(unit.id)),
		)
		.where(and(inArray(unit.id, ids), getUnitReadCondition(profileId)));
	const summaries = new Map<string, UnitVariantSummary>();
	for (const row of rows) {
		if (!isVariantCapableUnitKind(row.type)) continue;
		summaries.set(row.id, {
			id: row.id,
			type: row.type,
			title: row.title,
			cover: row.coverAssetId
				? {
						id: row.coverAssetId,
						url: imageAssetPresentationContentUrl(row.coverAssetId, "cover"),
					}
				: null,
		});
	}
	return summaries;
}

export async function getUnitVariantContext(
	unitId: string,
	profileId?: string,
): Promise<UnitVariantContext> {
	const relationships = await database
		.select()
		.from(unitVariant)
		.where(or(eq(unitVariant.variantUnitId, unitId), eq(unitVariant.mainUnitId, unitId)))
		.orderBy(asc(unitVariant.createdAt), asc(unitVariant.variantUnitId));
	const outbound = relationships.find(({ variantUnitId }) => variantUnitId === unitId);
	if (outbound) {
		const summaries = await readableSummaries([outbound.mainUnitId], profileId);
		const main = summaries.get(outbound.mainUnitId);
		return {
			role: "variant",
			relationUpdatedAt: outbound.updatedAt,
			main: main ? { state: "available", unit: main } : { state: "unavailable" },
		};
	}
	if (!relationships.length) return { role: "standalone" };
	const summaries = await readableSummaries(
		relationships.map(({ variantUnitId }) => variantUnitId),
		profileId,
	);
	return {
		role: "main",
		variants: relationships.flatMap((relationship) => {
			const summary = summaries.get(relationship.variantUnitId);
			return summary ? [summary] : [];
		}),
	};
}

export async function getUnitSeriesMemberships(
	unitId: string,
	profileId?: string,
): Promise<UnitSeriesMembership[]> {
	const mainUnitId = await resolveMainUnitId(database, unitId);
	const [readableMain] =
		mainUnitId === unitId
			? [{ id: unitId }]
			: await database
					.select({ id: unit.id })
					.from(unit)
					.where(and(eq(unit.id, mainUnitId), getUnitReadCondition(profileId)))
					.limit(1);
	const releaseUnitIds = mainUnitId === unitId || !readableMain ? [unitId] : [unitId, mainUnitId];
	const rows = await database
		.select({
			seriesId: seriesRelease.seriesId,
			releaseUnitId: seriesRelease.releaseUnitId,
			position: seriesRelease.position,
			releasedOn: seriesRelease.releasedOn,
			title: unitLocalization.title,
			coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
		})
		.from(unit)
		.innerJoin(series, eq(series.id, unit.id))
		.innerJoin(seriesRelease, eq(seriesRelease.seriesId, series.id))
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), isPrimaryUnitLocalization(unit.id)),
		)
		.where(
			and(
				inArray(seriesRelease.releaseUnitId, releaseUnitIds),
				getUnitReadCondition(profileId),
			),
		)
		.orderBy(
			sql`case when ${seriesRelease.releaseUnitId} = ${unitId}::uuid then 0 else 1 end`,
			seriesRelease.position,
			seriesRelease.seriesId,
		);
	const memberships = new Map<string, UnitSeriesMembership>();
	for (const row of rows) {
		if (memberships.has(row.seriesId)) continue;
		memberships.set(row.seriesId, {
			series: {
				id: row.seriesId,
				title: row.title,
				cover: row.coverAssetId
					? {
							id: row.coverAssetId,
							url: imageAssetPresentationContentUrl(row.coverAssetId, "cover"),
						}
					: null,
			},
			releaseUnitId: row.releaseUnitId,
			position: row.position,
			releasedOn: row.releasedOn,
			source: row.releaseUnitId === unitId ? "direct" : "main",
		});
	}
	return [...memberships.values()];
}

export async function updateUnitVariantContext(input: {
	readonly kind: VariantCapableUnitKind;
	readonly variantUnitId: string;
	readonly mainUnitId: string | null;
	readonly expectedMainUnitId: string | null;
	readonly actorProfileId: string;
	readonly authorization: UnitAuthorization<string>;
}): Promise<UnitVariantMutationResult> {
	return database.transaction(async (tx) => {
		const observedMainUnitId = await storedMainUnitId(tx, input.variantUnitId);
		await lockVariantGroups(tx, [input.variantUnitId, observedMainUnitId, input.mainUnitId]);
		const lockIds = input.mainUnitId
			? [input.variantUnitId, input.mainUnitId]
			: [input.variantUnitId];
		const locked = await lockUnits(tx, lockIds);
		const variant = locked.find(({ id }) => id === input.variantUnitId);
		if (!variant || variant.deletedAt) throw new UnitNotFound();
		if (!isVariantCapableUnitKind(variant.kind) || variant.kind !== input.kind)
			throw new UnitVariantKindMismatch();
		await input.authorization.ensureInTransaction(tx, input.variantUnitId, "unit.update", [
			"variant",
		]);

		const currentMainUnitId = await storedMainUnitId(tx, input.variantUnitId);
		if (currentMainUnitId === input.mainUnitId)
			return {
				variantUnitId: input.variantUnitId,
				mainUnitId: currentMainUnitId,
				changed: false,
			};
		if (currentMainUnitId !== input.expectedMainUnitId) {
			const currentDecision = currentMainUnitId
				? await input.authorization.decideInTransaction(tx, currentMainUnitId, "unit.read")
				: undefined;
			throw new UnitVariantChanged(currentDecision?.allowed ? currentMainUnitId : null);
		}

		const [inbound] = await tx
			.select({ variantUnitId: unitVariant.variantUnitId })
			.from(unitVariant)
			.where(eq(unitVariant.mainUnitId, input.variantUnitId))
			.limit(1);
		if (inbound) throw new UnitVariantSourceHasVariants();

		if (input.mainUnitId) {
			const pair = requireVariantPair(
				locked,
				input.variantUnitId,
				input.mainUnitId,
				input.kind,
			);
			await ensureTargetReadable(tx, input.authorization, input.mainUnitId);
			const [targetOutbound] = await tx
				.select({ mainUnitId: unitVariant.mainUnitId })
				.from(unitVariant)
				.where(eq(unitVariant.variantUnitId, input.mainUnitId))
				.limit(1);
			if (targetOutbound) throw new UnitVariantTargetIsVariant();
			if (isDiscoverableVariantUnit(pair.variant) && !isDiscoverableVariantUnit(pair.main))
				throw new UnitVariantMainUnavailable();
			await tx
				.insert(unitVariant)
				.values({
					variantUnitId: input.variantUnitId,
					mainUnitId: input.mainUnitId,
					unitKind: input.kind,
				})
				.onConflictDoUpdate({
					target: unitVariant.variantUnitId,
					set: { mainUnitId: input.mainUnitId, unitKind: input.kind },
				});
		} else {
			await tx.delete(unitVariant).where(eq(unitVariant.variantUnitId, input.variantUnitId));
		}

		await recordUnitRevision(tx, {
			unitId: input.variantUnitId,
			actorProfileId: input.actorProfileId,
			event: "update",
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "unit", id: input.variantUnitId },
			action: input.mainUnitId ? "unit.variant.main.set" : "unit.variant.main.detach",
			target: { kind: "unit", id: input.variantUnitId },
			details: {
				beforeMainUnitId: currentMainUnitId,
				afterMainUnitId: input.mainUnitId,
			},
		});
		return {
			variantUnitId: input.variantUnitId,
			mainUnitId: input.mainUnitId,
			changed: true,
		};
	});
}

export async function promoteUnitVariantToMain(input: {
	readonly kind: VariantCapableUnitKind;
	readonly variantUnitId: string;
	readonly expectedMainUnitId: string;
	readonly actorProfileId: string;
	readonly authorization: UnitAuthorization<string>;
}): Promise<UnitVariantPromotionResult> {
	return database.transaction(async (tx) => {
		await lockVariantGroups(tx, [input.variantUnitId, input.expectedMainUnitId]);
		const group = await tx
			.select({ variantUnitId: unitVariant.variantUnitId })
			.from(unitVariant)
			.where(eq(unitVariant.mainUnitId, input.expectedMainUnitId))
			.orderBy(unitVariant.variantUnitId);
		const siblingIds = group
			.map(({ variantUnitId }) => variantUnitId)
			.filter((unitId) => unitId !== input.variantUnitId);
		const locked = await lockUnits(tx, [
			input.variantUnitId,
			input.expectedMainUnitId,
			...siblingIds,
		]);
		const pair = requireVariantPair(
			locked,
			input.variantUnitId,
			input.expectedMainUnitId,
			input.kind,
		);
		const currentMainUnitId = await storedMainUnitId(tx, input.variantUnitId);
		if (currentMainUnitId !== input.expectedMainUnitId)
			throw new UnitVariantChanged(currentMainUnitId);
		await input.authorization.ensureInTransaction(
			tx,
			input.expectedMainUnitId,
			"unit.association.manage",
			["variant"],
		);
		await input.authorization.ensureInTransaction(tx, input.variantUnitId, "unit.update", [
			"variant",
		]);

		const remaining = locked.filter(({ id }) => siblingIds.includes(id));
		if (
			[...remaining, pair.main].some(isDiscoverableVariantUnit) &&
			!isDiscoverableVariantUnit(pair.variant)
		)
			throw new UnitVariantMainUnavailable();

		await tx.delete(unitVariant).where(eq(unitVariant.variantUnitId, input.variantUnitId));
		if (siblingIds.length)
			await tx
				.update(unitVariant)
				.set({ mainUnitId: input.variantUnitId })
				.where(inArray(unitVariant.variantUnitId, siblingIds));
		await tx.insert(unitVariant).values({
			variantUnitId: input.expectedMainUnitId,
			mainUnitId: input.variantUnitId,
			unitKind: input.kind,
		});

		const changedUnitIds = [
			input.variantUnitId,
			input.expectedMainUnitId,
			...siblingIds,
		].sort();
		for (const unitId of changedUnitIds)
			await recordUnitRevision(tx, {
				unitId,
				actorProfileId: input.actorProfileId,
				event: "update",
			});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "unit", id: input.variantUnitId },
			action: "unit.variant.main.promote",
			target: { kind: "unit", id: input.variantUnitId },
			details: {
				oldMainUnitId: input.expectedMainUnitId,
				newMainUnitId: input.variantUnitId,
				affectedUnitIds: changedUnitIds,
			},
		});
		return {
			oldMainUnitId: input.expectedMainUnitId,
			newMainUnitId: input.variantUnitId,
			affectedUnitIds: changedUnitIds,
		};
	});
}
