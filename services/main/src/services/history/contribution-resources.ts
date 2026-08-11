import { and, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";

import type { ContributionResourceListQuery } from "../api/history/schema";
import { database } from "../database";
import { profileResourceParticipation, unit } from "../database/schema";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { presentImageAsset } from "../units/service";
import { resourceSectionCondition } from "../units/resource-section";
import {
	decodeParticipationCursor,
	encodeParticipationCursor,
	type ParticipationCursorBoundary,
} from "./participation-cursor";

const ParticipationScanBudget = 4_096;
const ParticipationBatchMaximum = 256;

type RawContributionCandidate = {
	readonly resourceUnitId: string;
	readonly sortAt: unknown;
	readonly accepted: boolean;
	readonly language: ContentLanguage | null;
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

type PresentedContributionCandidate = {
	readonly id: string;
	readonly section: ContributionResourceListQuery["section"];
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly cover: { readonly id: string; readonly url: string } | null;
	readonly status: "draft" | "published" | "archived";
	readonly visibility: "public" | "unlisted" | "private";
	readonly createdResourceAt: Date | null;
	readonly firstContributedAt: Date | null;
	readonly lastContributedAt: Date | null;
	readonly contributionCount: number;
	readonly lastParticipatedAt: Date;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly cursorBoundary: ParticipationCursorBoundary;
};

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

async function selectContributionCandidateBatch(input: {
	readonly profileId: string;
	readonly query: ContributionResourceListQuery;
	readonly cursor?: ParticipationCursorBoundary;
	readonly scanLimit: number;
}): Promise<RawContributionCandidate[]> {
	const kind = input.query.kind ?? "all";
	const sortAt = participationSortColumn(kind);
	const cursorCondition = input.cursor
		? sql`and (${sortAt}, participation.resource_unit_id) < (
			${input.cursor.sortAt},
			${input.cursor.resourceUnitId}::uuid
		)`
		: sql``;
	const resource = alias(unit, "contribution_resource");
	const localizationLanguages = input.query.localizationLanguages ?? [];
	const accepted = and(
		eq(resource.status, "published"),
		eq(resource.visibility, "public"),
		eq(resource.moderationStatus, "approved"),
		sql`${resource.deletedAt} is null`,
		resourceSectionCondition(input.query.section, resource),
	) as SQL;
	const result = await database.execute<RawContributionCandidate>(sql`
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
			${resolvedUnitLocalizationLanguage(resource.id, localizationLanguages)} as language,
			${resolvedUnitLocalizationTitle(resource.id, localizationLanguages)} as title,
			${resolvedUnitLocalizationImageAssetId(resource.id, "cover", localizationLanguages)} as "coverAssetId",
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
		left join ${unit} contribution_resource on ${resource.id} = scanned.resource_unit_id
		order by
			scanned.sort_at desc nulls last,
			scanned.resource_unit_id desc nulls last
	`);
	return result.rows;
}

function presentContributionCandidate(
	row: RawContributionCandidate,
	section: ContributionResourceListQuery["section"],
): PresentedContributionCandidate | undefined {
	if (
		!row.accepted ||
		!row.language ||
		!row.status ||
		!row.visibility ||
		row.createdAt === null ||
		row.updatedAt === null
	)
		return undefined;
	return {
		id: row.resourceUnitId,
		section,
		language: row.language,
		title: row.title,
		cover: presentImageAsset(row.coverAssetId, "cover"),
		status: row.status,
		visibility: row.visibility,
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
}

export async function listCurrentProfileContributionResources(input: {
	readonly profileId: string;
	readonly query: ContributionResourceListQuery;
}) {
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
		const rows = await selectContributionCandidateBatch({
			profileId: input.profileId,
			query: input.query,
			cursor: scanCursor,
			scanLimit,
		});
		if (!rows.length) {
			exhausted = true;
			break;
		}
		for (const row of rows) {
			scanned += 1;
			scanCursor = {
				sortAt: dateValue(row.sortAt, "sortAt"),
				resourceUnitId: row.resourceUnitId,
			};
			const item = presentContributionCandidate(row, input.query.section);
			if (item) items.push(item);
			if (items.length >= limit + 1 || scanned >= ParticipationScanBudget) break;
		}
		exhausted = rows.length < scanLimit;
	}

	const page = items.slice(0, limit);
	const last = page.at(-1);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(page.map(({ id }) => id));
	const nextBoundary =
		items.length > limit
			? last?.cursorBoundary
			: !exhausted && scanned >= ParticipationScanBudget
				? scanCursor
				: undefined;
	return {
		items: page.map(({ cursorBoundary: _cursorBoundary, ...item }) => ({
			...item,
			slugAddress: slugAddresses.get(item.id) ?? null,
		})),
		nextCursor: nextBoundary ? encodeParticipationCursor(input.query, nextBoundary) : null,
	};
}
