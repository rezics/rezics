import { and, eq, sql, type SQL } from "drizzle-orm";
import {
	FollowableUnitOwnerValues,
	UnitOwnerValues,
	type FollowableUnitOwner,
	type UnitOwner,
} from "@rezics/reference";
import type { Authorization } from "../authorization";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";

import type { ContributionResourceListQuery } from "../api/history/schema";
import { database, type DatabaseTransaction } from "../database";
import { profileResourceParticipation } from "../database/schema";
import { listPathMembers, type TagPathMember } from "../tag-paths/service";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";

import {
	resourceSectionFromReference,
	studioResourceScopeCondition,
	type ResourceSection,
} from "../units/resource-section";
import {
	decodeParticipationCursor,
	encodeParticipationCursor,
	type ParticipationCursorBoundary,
} from "./participation-cursor";

const ParticipationScanBudget = 256;
const ParticipationBatchMaximum = 256;

type RawContributionCandidate = {
	readonly resourceUnitId: string;
	readonly sortAt: unknown;
	readonly accepted: boolean;
	readonly resourceOwner: string | null;
	readonly shape: string | null;
	readonly language: string | null;
	readonly title: string | null;
	readonly coverAssetId: string | null;
	readonly status: "draft" | "published" | "archived" | null;
	readonly visibility: "public" | "unlisted" | "private" | null;
	readonly createdResourceAt: unknown | null;
	readonly firstContributedAt: unknown | null;
	readonly lastContributedAt: unknown | null;
	readonly contributionCount: number | string;
	readonly lastParticipatedAt: unknown;
	readonly createdAt: unknown | null;
	readonly updatedAt: unknown | null;
};

type ContributionActivity = {
	readonly id: string;
	readonly section: ResourceSection;
	readonly createdResourceAt: Date | null;
	readonly firstContributedAt: Date | null;
	readonly lastContributedAt: Date | null;
	readonly contributionCount: number;
	readonly lastParticipatedAt: Date;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly cursorBoundary: ParticipationCursorBoundary;
};

type PresentedContributionCandidate =
	| (ContributionActivity & {
			readonly resourceOwner: FollowableUnitOwner;
			readonly shape: string;
			readonly presentation: {
				readonly kind: "resource";
				readonly slugAddress: null;
				readonly language: string | null;
				readonly title: string | null;
				readonly cover: { readonly id: string; readonly url: string } | null;
				readonly status: "draft" | "published" | "archived";
				readonly visibility: "public" | "unlisted" | "private";
			};
	  })
	| (ContributionActivity & {
			readonly section: "tag";
			readonly resourceOwner: "tag_path";
			readonly shape: string;
			readonly presentation: {
				readonly kind: "tag_path";
				readonly members: readonly TagPathMember[];
			};
	  });

function dateValue(value: unknown, field: string): Date {
	const parsed =
		value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
	if (!parsed || Number.isNaN(parsed.getTime()))
		throw new TypeError(`Contribution resource ${field} is not a valid date`);
	return parsed;
}

function countValue(value: number | string): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0)
		throw new TypeError("Contribution resource count is outside the safe integer range");
	return parsed;
}

function ownerValue(value: string | null): UnitOwner | undefined {
	return UnitOwnerValues.find((owner) => owner === value);
}
function followable(owner: UnitOwner): owner is FollowableUnitOwner {
	return FollowableUnitOwnerValues.some((value) => value === owner);
}

function participationSortColumn(kind: NonNullable<ContributionResourceListQuery["kind"]>): SQL {
	switch (kind) {
		case "all":
			return sql`participation.last_participated_at`;
		case "created":
			return sql`participation.created_resource_at`;
		case "contributed":
			return sql`participation.last_contributed_at`;
	}
}

function participationKindCondition(kind: NonNullable<ContributionResourceListQuery["kind"]>): SQL {
	switch (kind) {
		case "all":
			return sql`true`;
		case "created":
			return sql`participation.created_resource_at is not null`;
		case "contributed":
			return sql`participation.last_contributed_at is not null`;
	}
}

async function selectContributionCandidateBatch(
	tx: DatabaseTransaction,
	input: {
		readonly profileId: string;
		readonly query: ContributionResourceListQuery;
		readonly includeDevelopmentPreview: boolean;
		readonly cursor?: ParticipationCursorBoundary;
		readonly scanLimit: number;
	},
): Promise<RawContributionCandidate[]> {
	const kind = input.query.kind ?? "all";
	const sortAt = participationSortColumn(kind);
	const cursorCondition = input.cursor
		? sql`and (${sortAt}, participation.resource_unit_id) < (
			${input.cursor.sortAt},
			${input.cursor.resourceUnitId}::uuid
		)`
		: sql``;
	const resource = {
		id: sql`contribution_resource.id`,
		owner: sql`contribution_resource.owner`,
		shape: sql`contribution_resource.shape`,
		status: sql`contribution_resource.status`,
		visibility: sql`contribution_resource.visibility`,
		moderationStatus: sql`contribution_resource.moderation_status`,
		deletedAt: sql`contribution_resource.deleted_at`,
		createdAt: sql`contribution_resource.created_at`,
		updatedAt: sql`contribution_resource.updated_at`,
	};
	const accepted = and(
		eq(resource.status, "published"),
		eq(resource.visibility, "public"),
		eq(resource.moderationStatus, "approved"),
		sql`${resource.deletedAt} is null`,
		studioResourceScopeCondition(
			input.query.section,
			{ owner: resource.owner, shape: resource.shape },
			{ includeDevelopmentPreview: input.includeDevelopmentPreview },
		),
	);
	const result = await tx.execute<RawContributionCandidate>(sql`
		with scanned as materialized (
			select
				participation.resource_unit_id,
				${sortAt} as sort_at,
				participation.created_resource_at,
				participation.first_contributed_at,
				participation.last_contributed_at,
				participation.contribution_count,
				participation.last_participated_at
			from ${profileResourceParticipation} participation
			where participation.profile_id = ${input.profileId}
				and ${participationKindCondition(kind)}
				${cursorCondition}
			order by
				${sortAt} desc nulls last,
				participation.resource_unit_id desc nulls last
			limit ${input.scanLimit}
		)
		select
			scanned.resource_unit_id as "resourceUnitId",
			scanned.sort_at as "sortAt",
			${accepted} as accepted,
			${resource.owner} as "resourceOwner",
			${resource.shape} as "shape",
			null::text as language,
			null::text as title,
			null::uuid as "coverAssetId",
			${resource.status} as status,
			${resource.visibility} as visibility,
			scanned.created_resource_at as "createdResourceAt",
			scanned.first_contributed_at as "firstContributedAt",
			scanned.last_contributed_at as "lastContributedAt",
			scanned.contribution_count::float8 as "contributionCount",
			scanned.last_participated_at as "lastParticipatedAt",
			${resource.createdAt} as "createdAt",
			${resource.updatedAt} as "updatedAt"
		from scanned
		left join lateral public.read_unit_state(scanned.resource_unit_id,false) contribution_resource on true
		order by
			scanned.sort_at desc nulls last,
			scanned.resource_unit_id desc nulls last
	`);
	return result.rows;
}

function presentContributionCandidate(
	row: RawContributionCandidate,
): PresentedContributionCandidate | undefined {
	const resourceOwner = ownerValue(row.resourceOwner);
	if (
		!row.accepted ||
		!resourceOwner ||
		!row.shape ||
		!row.status ||
		!row.visibility ||
		row.createdAt === null ||
		row.updatedAt === null
	)
		return undefined;
	const section = resourceSectionFromReference(resourceOwner, row.shape);
	if (!section) return undefined;
	const activity = {
		id: row.resourceUnitId,
		section,
		createdResourceAt:
			row.createdResourceAt === null ? null : dateValue(row.createdResourceAt, "createdResourceAt"),
		firstContributedAt:
			row.firstContributedAt === null
				? null
				: dateValue(row.firstContributedAt, "firstContributedAt"),
		lastContributedAt:
			row.lastContributedAt === null ? null : dateValue(row.lastContributedAt, "lastContributedAt"),
		contributionCount: countValue(row.contributionCount),
		lastParticipatedAt: dateValue(row.lastParticipatedAt, "lastParticipatedAt"),
		createdAt: dateValue(row.createdAt, "createdAt"),
		updatedAt: dateValue(row.updatedAt, "updatedAt"),
		cursorBoundary: {
			sortAt: dateValue(row.sortAt, "sortAt"),
			resourceUnitId: row.resourceUnitId,
		},
	};
	if (resourceOwner === "tag_path") {
		if (section !== "tag") return undefined;
		return {
			...activity,
			section,
			resourceOwner,
			shape: row.shape,
			presentation: { kind: "tag_path", members: [] },
		};
	}
	if (!followable(resourceOwner)) return undefined;
	return {
		...activity,
		resourceOwner,
		shape: row.shape,
		presentation: {
			kind: "resource",
			slugAddress: null,
			language: row.language,
			title: row.title,
			cover: null,
			status: row.status,
			visibility: row.visibility,
		},
	};
}

export async function listCurrentProfileContributionResources(input: {
	readonly authorization: Authorization<string>;
	readonly query: ContributionResourceListQuery;
	readonly includeDevelopmentPreview: boolean;
}) {
	return database.transaction(
		async (tx) => {
			const limit = input.query.limit ?? 30;
			const initialCursor = decodeParticipationCursor(input.query.cursor, input.query);
			const items: PresentedContributionCandidate[] = [];
			let scanCursor = initialCursor;
			let scanned = 0;
			let exhausted = false;
			while (items.length < limit + 1 && scanned < ParticipationScanBudget && !exhausted) {
				const scanLimit = Math.min(
					ParticipationBatchMaximum,
					ParticipationScanBudget - scanned,
					Math.max(64, (limit + 1 - items.length) * 3),
				);
				const rows = await selectContributionCandidateBatch(tx, {
					profileId: input.authorization.profileId,
					query: input.query,
					includeDevelopmentPreview: input.includeDevelopmentPreview,
					cursor: scanCursor,
					scanLimit,
				});
				if (!rows.length) {
					exhausted = true;
					break;
				}
				const readable = await input.authorization.unit.readableUnitIdsInTransaction(
					tx,
					rows.filter((row) => row.accepted).map((row) => row.resourceUnitId),
				);
				for (const row of rows) {
					scanned += 1;
					scanCursor = {
						sortAt: dateValue(row.sortAt, "sortAt"),
						resourceUnitId: row.resourceUnitId,
					};
					const item = readable.has(row.resourceUnitId)
						? presentContributionCandidate(row)
						: undefined;
					if (item) items.push(item);
					if (items.length >= limit + 1 || scanned >= ParticipationScanBudget) break;
				}
				exhausted = rows.length < scanLimit;
			}

			const page = items.slice(0, limit);
			const last = page.at(-1);
			const localizedIds = page.flatMap((item) =>
				item.resourceOwner === "tag_path" ? [] : [item.id],
			);
			const pathIds = page.flatMap((item) => (item.resourceOwner === "tag_path" ? [item.id] : []));
			const [slugAddresses, pathMembers, presentations] = await Promise.all([
				getPublicCanonicalUnitSlugAddresses(localizedIds),
				listPathMembers(pathIds, input.query.localizationLanguages),
				readUnitPresentationsInTransaction(tx, localizedIds, input.query.localizationLanguages),
			]);
			const nextBoundary =
				items.length > limit
					? last?.cursorBoundary
					: !exhausted && scanned >= ParticipationScanBudget
						? scanCursor
						: undefined;
			return {
				items: page.map(({ cursorBoundary: _cursorBoundary, ...item }) =>
					item.resourceOwner === "tag_path"
						? {
								...item,
								presentation: {
									...item.presentation,
									members: pathMembers.get(item.id) ?? [],
								},
							}
						: {
								...item,
								presentation: {
									...item.presentation,
									slugAddress: slugAddresses.get(item.id) ?? null,
									title: presentations.get(item.id)?.title ?? null,
									language: presentations.get(item.id)?.language ?? null,
								},
							},
				),
				nextCursor: nextBoundary ? encodeParticipationCursor(input.query, nextBoundary) : null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
