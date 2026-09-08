import { and, eq, inArray, sql } from "drizzle-orm";
import {
	getPublicEntitySummariesByIds,
	type PublicEntitySummary,
} from "../participation/presentation";

import type { Authorization } from "../authorization";
import { unitStateRelation } from "./state-relation";
import { readUnitPresentationsInTransaction, type UnitPresentation } from "./presentation-reader";
export type { UnitPresentation } from "./presentation-reader";
import { exactCount, lowerBoundCount, type CountResult } from "../counts/contract";
import { database, type DatabaseExecutor } from "../database";
import { toSafeInteger } from "../database/integer";
import { creditAttribution, unitFollowStat } from "../database/schema";
import type { CreditAttributionRole } from "../database/schema/contract-values";
import { WorkPolicy } from "../performance/policy";
import type { LocalizationLanguageQuery } from "./localization";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "./slug-address";

export const PublisherAttributionRole = "publisher" as const;

export type UnitAttributionSummary = {
	readonly id: string;
	readonly role: CreditAttributionRole;
	readonly position: string;
	readonly creditedEntity: PublicEntitySummary;
};

export type UnitSummary = UnitPresentation & {
	readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
};

export interface AttributionSummaryReadOptions {
	readonly maximumPerSourceUnit?: number;
}

interface AttributionSummaryRow {
	readonly [key: string]: unknown;
	readonly sourceUnitId: string;
	readonly id: string;
	readonly role: CreditAttributionRole;
	readonly position: string;
	readonly creditedEntityId: string;
}

export type UnitAttributionSummaryWithStatistics = Omit<
	UnitAttributionSummary,
	"creditedEntity"
> & {
	readonly creditedEntity: PublicEntitySummary & {
		readonly creditedBookCount: CountResult;
		readonly followerCount: number;
	};
};

export async function getPublicUnitSummariesByIds(
	unitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitSummary>> {
	const ids = [...new Set(unitIds)];
	if (!ids.length) return new Map();
	if (ids.length > 500)
		throw new RangeError("At most 500 explicit presentation targets are admitted");
	const presentations = await database.transaction(
		async (tx) => {
			const candidates = database
				.select({ id: sql<string>`unnest(${sql.param(ids)}::uuid[])`.as("id") })
				.as("public_summary_candidates");
			const state = unitStateRelation(candidates.id, "public_summary_state");
			const visible = await tx
				.select({ id: state.id })
				.from(candidates)
				.innerJoinLateral(state, sql`true`)
				.where(
					and(
						eq(state.status, "published"),
						inArray(state.visibility, ["public", "unlisted"]),
						eq(state.moderationStatus, "approved"),
						sql`${state.deletedAt} is null`,
					),
				)
				.limit(ids.length);
			return readUnitPresentationsInTransaction(
				tx,
				visible.map((row) => row.id),
				localizationLanguages,
			);
		},
		{ isolationLevel: "repeatable read" },
	);
	const slugs = await getPublicCanonicalUnitSlugAddresses([...presentations.keys()]);
	return new Map(
		[...presentations].map(([id, value]) => [id, { ...value, slugAddress: slugs.get(id) ?? null }]),
	);
}
/** Full request authorization, rather than a public Entity identifier, decides private visibility. */
export async function getReadableUnitPresentationsByIds(input: {
	readonly unitIds: readonly string[];
	readonly localizationLanguages: LocalizationLanguageQuery;
	readonly authorization: Pick<Authorization, "unit">;
}): Promise<Map<string, UnitPresentation>> {
	const ids = [...new Set(input.unitIds)];
	if (!ids.length) return new Map();
	if (ids.length > 500)
		throw new RangeError("At most 500 explicit presentation targets are admitted");
	return database.transaction(
		async (tx) => {
			const allowed = await input.authorization.unit.readableUnitIdsInTransaction(tx, ids);
			return readUnitPresentationsInTransaction(
				tx,
				ids.filter((id) => allowed.has(id)),
				input.localizationLanguages,
			);
		},
		{ isolationLevel: "repeatable read" },
	);
}

async function getAttributionStatisticsByUnitIds(
	unitIds: readonly string[],
): Promise<
	Map<string, { readonly creditedBookCount: CountResult; readonly followerCount: number }>
> {
	if (!unitIds.length) return new Map();
	if (new Set(unitIds).size > 500)
		throw new RangeError("Attribution statistics require at most 500 explicit targets");
	type CreditedBookRow = {
		readonly creditedEntityId: string;
		readonly creditedCount: string;
		readonly candidateCount: string;
	};
	const creditedEntityArray = sql`array[${sql.join(
		[...new Set(unitIds)].map((unitId) => sql`${unitId}::uuid`),
		sql`, `,
	)}]::uuid[]`;
	const [followerRows, creditedBookRows] = await Promise.all([
		database
			.select({
				unitId: unitFollowStat.unitId,
				followerCount: unitFollowStat.followerCount,
			})
			.from(unitFollowStat)
			.where(inArray(unitFollowStat.unitId, [...unitIds])),
		database.execute<CreditedBookRow>(sql`
 select requested.credited_entity_id as "creditedEntityId", counted.credited_count as "creditedCount", counted.candidate_count as "candidateCount"
 from unnest(${creditedEntityArray}) as requested(credited_entity_id)
 cross join lateral (
  with candidates as materialized (
   select attribution.source_unit_id from ${creditAttribution} attribution
   where attribution.credited_entity_id=requested.credited_entity_id and attribution.role in ('author','co-author')
   limit ${WorkPolicy.count.maxCreditedBookCountScan}
  )
  select count(distinct source_unit.id) as credited_count,count(*) as candidate_count from candidates
  left join public.publishing_identity source_unit on source_unit.id=candidates.source_unit_id and source_unit.shape='work' and source_unit.status='published' and source_unit.visibility<>'private' and source_unit.moderation_status='approved' and source_unit.deleted_at is null
 ) counted
 `),
	]);
	const followerCounts = new Map(
		followerRows.map(({ unitId, followerCount }) => [
			unitId,
			toSafeInteger(followerCount, "Unit follower count"),
		]),
	);
	const creditedBookValues = new Map(
		creditedBookRows.rows.map((row) => [
			row.creditedEntityId,
			{
				value: toSafeInteger(row.creditedCount, "Credited work count"),
				candidates: toSafeInteger(row.candidateCount, "Credited work candidates"),
			},
		]),
	);
	const creditedBookCount = (unitId: string): CountResult => {
		const { value, candidates } = creditedBookValues.get(unitId) ?? { value: 0, candidates: 0 };
		return candidates < WorkPolicy.count.maxCreditedBookCountScan
			? exactCount(value)
			: lowerBoundCount(value);
	};
	return new Map(
		unitIds.map((unitId) => [
			unitId,
			{
				creditedBookCount: creditedBookCount(unitId),
				followerCount: followerCounts.get(unitId) ?? 0,
			},
		]),
	);
}

/**
 * Records the public identity shown as the publisher of a newly created Post.
 * Access ownership is created separately; neither relationship implies the other.
 */
export async function createProfilePublisherAttribution(
	executor: DatabaseExecutor,
	input: { readonly sourceUnitId: string; readonly profileId: string },
): Promise<void> {
	await executor
		.insert(creditAttribution)
		.values({
			sourceUnitId: input.sourceUnitId,
			creditedEntityId: input.profileId,
			role: PublisherAttributionRole,
		})
		.onConflictDoNothing();
}

export async function getAttributionSummariesByUnitIds(
	sourceUnitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
	options: AttributionSummaryReadOptions = {},
): Promise<Map<string, UnitAttributionSummary[]>> {
	const result = new Map<string, UnitAttributionSummary[]>();
	const requestedSourceUnitIds = [...new Set(sourceUnitIds)];
	if (requestedSourceUnitIds.length > 500)
		throw new RangeError("At most 500 attribution owners are admitted");
	const maximum = options.maximumPerSourceUnit ?? 128;
	for (const sourceUnitId of requestedSourceUnitIds) result.set(sourceUnitId, []);
	if (!requestedSourceUnitIds.length) return result;
	if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 128)
		throw new RangeError("maximumPerSourceUnit must be a positive safe integer");

	const rows: AttributionSummaryRow[] = (
		await database.execute<AttributionSummaryRow>(sql`
					select
						requested.source_unit_id as "sourceUnitId",
						bounded.id,
						bounded.role,
						bounded.position,
						bounded.credited_entity_id as "creditedEntityId"
					from unnest(array[${sql.join(
						requestedSourceUnitIds.map((sourceUnitId) => sql`${sourceUnitId}::uuid`),
						sql`, `,
					)}]::uuid[]) as requested(source_unit_id)
					cross join lateral (
						select
							attribution.id,
							attribution.role,
							attribution.position,
							attribution.credited_entity_id
						from ${creditAttribution} as attribution
						where attribution.source_unit_id = requested.source_unit_id
						order by attribution.position, attribution.id
						limit ${maximum}
					) as bounded
					order by requested.source_unit_id, bounded.position, bounded.id
				`)
	).rows;
	const creditedEntitys = await getPublicEntitySummariesByIds(
		rows.map(({ creditedEntityId }) => creditedEntityId),
		localizationLanguages,
	);
	for (const row of rows) {
		const creditedEntity = creditedEntitys.get(row.creditedEntityId);
		if (!creditedEntity) continue;
		result.get(row.sourceUnitId)?.push({
			id: row.id,
			role: row.role,
			position: row.position,
			creditedEntity,
		});
	}
	return result;
}

export async function getAttributionSummariesWithStatisticsByUnitIds(
	sourceUnitIds: readonly string[],
	localizationLanguages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitAttributionSummaryWithStatistics[]>> {
	const summaries = await getAttributionSummariesByUnitIds(sourceUnitIds, localizationLanguages);
	const statistics = await getAttributionStatisticsByUnitIds(
		[...summaries.values()].flatMap((items) =>
			items.map(({ creditedEntity }) => creditedEntity.id),
		),
	);
	return new Map(
		[...summaries].map(([sourceUnitId, items]) => [
			sourceUnitId,
			items.map((item) => ({
				...item,
				creditedEntity: {
					...item.creditedEntity,
					...(statistics.get(item.creditedEntity.id) ?? {
						creditedBookCount: exactCount(0),
						followerCount: 0,
					}),
				},
			})),
		]),
	);
}
