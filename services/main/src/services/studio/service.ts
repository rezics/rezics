import { and, eq, exists, isNull, not, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";

import type { UnitAuthorization } from "../authorization/unit/authorization";
import {
	getExplicitUnitAnyScopePermissionCondition,
	getUnitReadCondition,
} from "../authorization/unit/query";
import { profileCanManageRealmAccess } from "../authorization/unit/realm-subject";
import { database } from "../database";
import {
	realm,
	realmMember,
	studioProfileEditorCandidate,
	studioRealmEditorCandidate,
	studioResourceVisit,
	unit,
	unitAccessGrant,
	unitOwnership,
} from "../database/schema";
import type {
	StudioAccessSource,
	StudioContentListQuery,
	StudioWorkspaceSource,
} from "../api/users/schema";
import { StudioRealmSubjectLimitExceeded } from "../api/users/errors";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { resourceSectionCondition } from "../units/resource-section";
import { presentImageAsset } from "../units/service";
import { decodeStudioCursor, encodeStudioCursor, type StudioCursorBoundary } from "./cursor";

const StudioCandidateScanBudget = 4_096;
const StudioRealmSubjectLimit = 256;
const StudioCandidateBatchMaximum = 256;

type RealmSubject = {
	readonly realmId: string;
	readonly realmRelation: "member" | "access_manager";
};

type RawRealmSubject = {
	readonly realmId: string;
	readonly realmRelation: string;
};

type RawWorkspaceCandidate = {
	readonly unitId: string;
	readonly sourceKind: string;
	readonly sourceKey: string;
	readonly relevantAt: unknown;
	readonly ownerSince: unknown | null;
	readonly directGrantSince: unknown | null;
	readonly realmGrantSince: unknown | null;
	readonly lastVisitedAt: unknown | null;
	readonly accepted: boolean;
	readonly hasOwnerAccess: boolean;
	readonly hasDirectAccess: boolean;
	readonly hasRealmAccess: boolean;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly coverAssetId: string | null;
	readonly status: "draft" | "published" | "archived" | null;
	readonly visibility: "public" | "unlisted" | "private" | null;
	readonly createdAt: unknown | null;
	readonly updatedAt: unknown | null;
};

type PresentedWorkspaceCandidate = {
	readonly id: string;
	readonly section: StudioContentListQuery["section"];
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly cover: { readonly id: string; readonly url: string } | null;
	readonly status: "draft" | "published" | "archived";
	readonly visibility: "public" | "unlisted" | "private";
	readonly accessSources: StudioAccessSource[];
	readonly assignedAt: Date;
	readonly lastVisitedAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly cursorBoundary: StudioCursorBoundary;
};

function dateValue(value: unknown, field: string): Date {
	const parsed =
		value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
	if (!parsed || Number.isNaN(parsed.getTime()))
		throw new TypeError(`Studio ${field} is not a valid date`);
	return parsed;
}

function realmRelation(value: string): RealmSubject["realmRelation"] {
	if (value === "member" || value === "access_manager") return value;
	throw new TypeError("Studio Realm subject relation is invalid");
}

/** Loads the small dynamic userset used to seek Realm candidate streams. */
async function loadRealmSubjects(profileId: string): Promise<RealmSubject[]> {
	const managedRealm = alias(unit, "studio_managed_realm_subject");
	const result = await database.execute<RawRealmSubject>(sql`
		with possible_subject as (
			select member.realm_id, 'member'::text as realm_relation
			from ${realmMember} member
			where member.profile_id = ${profileId}
				and member.state = 'active'

			union all

			select ownership.unit_id, 'access_manager'
			from ${unitOwnership} ownership
			where ownership.profile_id = ${profileId}
				and ownership.revoked_at is null

			union all

			select access_grant.unit_id, 'access_manager'
			from ${unitAccessGrant} access_grant
			where access_grant.subject_kind = 'profile'
				and access_grant.profile_id = ${profileId}
				and access_grant.permission = 'unit.access.manage'
				and cardinality(access_grant.scope) = 0
				and access_grant.revoked_at is null
				and (access_grant.expires_at is null or access_grant.expires_at > now())

			union all

			select access_grant.unit_id, 'access_manager'
			from ${unitAccessGrant} access_grant
			join ${realmMember} member
				on member.realm_id = access_grant.realm_id
				and member.profile_id = ${profileId}
				and member.state = 'active'
			where access_grant.subject_kind = 'realm'
				and access_grant.realm_relation = 'member'
				and access_grant.permission = 'unit.access.manage'
				and cardinality(access_grant.scope) = 0
				and access_grant.revoked_at is null
				and (access_grant.expires_at is null or access_grant.expires_at > now())
		)
		select distinct
			possible_subject.realm_id as "realmId",
			possible_subject.realm_relation as "realmRelation"
		from possible_subject
		where exists (
			select 1
			from ${realm}
			where ${realm.id} = possible_subject.realm_id
		)
			and (
				possible_subject.realm_relation = 'member'
			or exists (
					select 1
					from ${unit} studio_managed_realm_subject
					where ${managedRealm.id} = possible_subject.realm_id
						and ${profileCanManageRealmAccess(database, managedRealm.id, profileId)}
				)
			)
		order by possible_subject.realm_id, possible_subject.realm_relation
		limit ${StudioRealmSubjectLimit + 1}
	`);
	if (result.rows.length > StudioRealmSubjectLimit)
		throw new StudioRealmSubjectLimitExceeded(StudioRealmSubjectLimit);
	return result.rows.map((subject) => ({
		realmId: subject.realmId,
		realmRelation: realmRelation(subject.realmRelation),
	}));
}

function cursorCondition(
	cursor: StudioCursorBoundary | undefined,
	relevantAt: SQL,
	unitId: SQL,
	sourceKey: SQL,
): SQL {
	return cursor
		? sql`(${relevantAt}, ${unitId}, ${sourceKey}) < (
			${cursor.relevantAt},
			${cursor.unitId}::uuid,
			${cursor.sourceKey}
		)`
		: sql`true`;
}

function emptyCandidateStream(): SQL {
	return sql`
		select
			null::uuid as unit_id,
			null::timestamptz as relevant_at,
			null::text as source_kind,
			null::text as source_key,
			null::uuid as realm_id,
			null::realm_access_subject_relation as realm_relation,
			null::timestamptz as owner_since,
			null::timestamptz as direct_grant_since,
			null::timestamptz as realm_grant_since
		where false
	`;
}

function profileCandidateStream(input: {
	readonly profileId: string;
	readonly source: StudioWorkspaceSource;
	readonly cursor?: StudioCursorBoundary;
	readonly scanLimit: number;
}): SQL {
	if (input.source === "delegated") return emptyCandidateStream();
	const sourceCondition =
		input.source === "owned"
			? sql`candidate.owner_since is not null`
			: input.source === "direct"
				? sql`candidate.direct_grant_since is not null`
				: sql`true`;
	const sourceKey = sql`'profile'::text`;
	return sql`
		select
			candidate.unit_id,
			candidate.relevant_at,
			'profile'::text as source_kind,
			${sourceKey} as source_key,
			null::uuid as realm_id,
			null::realm_access_subject_relation as realm_relation,
			candidate.owner_since,
			candidate.direct_grant_since,
			null::timestamptz as realm_grant_since
		from ${studioProfileEditorCandidate} candidate
		where candidate.profile_id = ${input.profileId}
			and (candidate.valid_until is null or candidate.valid_until > now())
			and ${sourceCondition}
			and ${cursorCondition(
				input.cursor,
				sql`candidate.relevant_at`,
				sql`candidate.unit_id`,
				sourceKey,
			)}
		order by
			candidate.relevant_at desc nulls last,
			candidate.unit_id desc nulls last,
			source_key desc nulls last
		limit ${input.scanLimit}
	`;
}

function realmSubjectValues(subjects: readonly RealmSubject[]): SQL {
	if (!subjects.length)
		return sql`select null::uuid as realm_id, null::realm_access_subject_relation as realm_relation where false`;
	return sql`values ${sql.join(
		subjects.map(
			(subject) =>
				sql`(${subject.realmId}::uuid, ${subject.realmRelation}::realm_access_subject_relation)`,
		),
		sql`, `,
	)}`;
}

function realmCandidateStream(input: {
	readonly source: StudioWorkspaceSource;
	readonly cursor?: StudioCursorBoundary;
	readonly scanLimit: number;
}): SQL {
	if (input.source === "owned" || input.source === "direct") return emptyCandidateStream();
	const sourceKey = sql`(
		'realm:' || candidate.realm_id::text || ':' || candidate.realm_relation::text
	)`;
	return sql`
		select
			candidate.unit_id,
			candidate.relevant_at,
			'realm'::text as source_kind,
			${sourceKey} as source_key,
			candidate.realm_id,
			candidate.realm_relation,
			null::timestamptz as owner_since,
			null::timestamptz as direct_grant_since,
			candidate.grant_since as realm_grant_since
		from realm_subject subject
		cross join lateral (
			select realm_candidate.*
			from ${studioRealmEditorCandidate} realm_candidate
			where realm_candidate.realm_id = subject.realm_id
				and realm_candidate.realm_relation = subject.realm_relation
				and (realm_candidate.valid_until is null or realm_candidate.valid_until > now())
				and ${cursorCondition(
					input.cursor,
					sql`realm_candidate.relevant_at`,
					sql`realm_candidate.unit_id`,
					sql`('realm:' || realm_candidate.realm_id::text || ':' || realm_candidate.realm_relation::text)`,
				)}
			order by
				realm_candidate.relevant_at desc nulls last,
				realm_candidate.unit_id desc nulls last
			limit ${input.scanLimit}
		) candidate
		order by
			candidate.relevant_at desc nulls last,
			candidate.unit_id desc nulls last,
			source_key desc nulls last
		limit ${input.scanLimit}
	`;
}

function profileEffectiveCondition(
	source: StudioWorkspaceSource,
	ownerAccess: SQL,
	directAccess: SQL,
): SQL {
	switch (source) {
		case "all":
			return or(ownerAccess, directAccess) as SQL;
		case "owned":
			return ownerAccess;
		case "direct":
			return directAccess;
		case "delegated":
			return sql`false`;
	}
}

async function selectWorkspaceCandidateBatch(input: {
	readonly profileId: string;
	readonly query: StudioContentListQuery;
	readonly realmSubjects: readonly RealmSubject[];
	readonly cursor?: StudioCursorBoundary;
	readonly scanLimit: number;
}): Promise<RawWorkspaceCandidate[]> {
	const source = input.query.source ?? "all";
	const resource = alias(unit, "studio_workspace_resource");
	const subjectRealm = alias(unit, "studio_workspace_subject_realm");
	const otherRealmCandidate = alias(
		studioRealmEditorCandidate,
		"studio_other_realm_editor_candidate",
	);
	const ownerAccess = exists(
		database
			.select({ id: unitOwnership.id })
			.from(unitOwnership)
			.where(
				and(
					eq(unitOwnership.unitId, resource.id),
					eq(unitOwnership.profileId, input.profileId),
					isNull(unitOwnership.revokedAt),
				),
			),
	);
	const directAccess = getExplicitUnitAnyScopePermissionCondition(
		input.profileId,
		"unit.update",
		{ source: { kind: "profile" }, includeOwnership: false },
		resource,
	);
	const realmAccess = getExplicitUnitAnyScopePermissionCondition(
		input.profileId,
		"unit.update",
		{
			source: {
				kind: "realm",
				realmId: sql`page.realm_id`,
				realmRelation: sql`page.realm_relation`,
			},
			includeOwnership: false,
		},
		resource,
	);
	const currentRealmSubject = exists(
		database
			.select({ id: subjectRealm.id })
			.from(subjectRealm)
			.where(
				and(
					eq(subjectRealm.id, sql`page.realm_id`),
					or(
						and(
							sql`page.realm_relation = 'member'::realm_access_subject_relation`,
							exists(
								database
									.select({ profileId: realmMember.profileId })
									.from(realmMember)
									.where(
										and(
											eq(realmMember.realmId, subjectRealm.id),
											eq(realmMember.profileId, input.profileId),
											eq(realmMember.state, "active"),
										),
									),
							),
						),
						and(
							sql`page.realm_relation = 'access_manager'::realm_access_subject_relation`,
							profileCanManageRealmAccess(database, subjectRealm.id, input.profileId),
						),
					),
				),
			),
	);
	const otherRealmAccess = getExplicitUnitAnyScopePermissionCondition(
		input.profileId,
		"unit.update",
		{
			source: {
				kind: "realm",
				realmId: otherRealmCandidate.realmId,
				realmRelation: otherRealmCandidate.realmRelation,
			},
			includeOwnership: false,
		},
		resource,
	);
	const earlierRealmSource = sql`exists (
		select 1
		from realm_subject earlier_subject
		join ${studioRealmEditorCandidate} studio_other_realm_editor_candidate
			on ${otherRealmCandidate.realmId} = earlier_subject.realm_id
			and ${otherRealmCandidate.realmRelation} = earlier_subject.realm_relation
		where ${otherRealmCandidate.unitId} = ${resource.id}
			and (
				${otherRealmCandidate.validUntil} is null
				or ${otherRealmCandidate.validUntil} > now()
			)
			and ${otherRealmAccess}
			and (
				'realm:' || ${otherRealmCandidate.realmId}::text || ':' || ${otherRealmCandidate.realmRelation}::text
			) < page.source_key
	)`;
	const canonicalRealmAccess = and(
		currentRealmSubject,
		realmAccess,
		source === "all" ? not(or(ownerAccess, directAccess) as SQL) : sql`true`,
		not(earlierRealmSource),
	) as SQL;
	const acceptedSource = sql`case
		when page.source_kind = 'profile' then ${profileEffectiveCondition(
			source,
			ownerAccess,
			directAccess,
		)}
		when page.source_kind = 'realm' then ${canonicalRealmAccess}
		else false
	end`;
	const statusCondition = input.query.status ? eq(resource.status, input.query.status) : sql`true`;
	const visibilityCondition = input.query.visibility
		? eq(resource.visibility, input.query.visibility)
		: sql`true`;
	const localizationLanguages = input.query.localizationLanguages ?? [];
	const accepted = and(
		sql`${resource.id} is not null`,
		getUnitReadCondition(input.profileId, {}, resource),
		resourceSectionCondition(input.query.section, resource),
		statusCondition,
		visibilityCondition,
		acceptedSource,
	) as SQL;
	const result = await database.execute<RawWorkspaceCandidate>(sql`
		with realm_subject (realm_id, realm_relation) as materialized (
			${realmSubjectValues(input.realmSubjects)}
		), profile_scan as materialized (
			${profileCandidateStream({
				profileId: input.profileId,
				source,
				cursor: input.cursor,
				scanLimit: input.scanLimit,
			})}
		), realm_scan as materialized (
			${realmCandidateStream({
				source,
				cursor: input.cursor,
				scanLimit: input.scanLimit,
			})}
		), scanned as materialized (
			select * from profile_scan
			union all
			select * from realm_scan
		), page as materialized (
			select *
			from scanned
			order by
				relevant_at desc nulls last,
				unit_id desc nulls last,
				source_key desc nulls last
			limit ${input.scanLimit}
		)
		select
			page.unit_id as "unitId",
			page.source_kind as "sourceKind",
			page.source_key as "sourceKey",
			page.relevant_at as "relevantAt",
			page.owner_since as "ownerSince",
			page.direct_grant_since as "directGrantSince",
			page.realm_grant_since as "realmGrantSince",
			visit.last_visited_at as "lastVisitedAt",
			${accepted} as accepted,
			${ownerAccess} as "hasOwnerAccess",
			${directAccess} as "hasDirectAccess",
			case when page.source_kind = 'realm' then ${realmAccess} else false end as "hasRealmAccess",
			${resolvedUnitLocalizationLanguage(resource.id, localizationLanguages)} as language,
			${resolvedUnitLocalizationTitle(resource.id, localizationLanguages)} as title,
			${resolvedUnitLocalizationImageAssetId(resource.id, "cover", localizationLanguages)} as "coverAssetId",
			${resource.status} as status,
			${resource.visibility} as visibility,
			${resource.createdAt} as "createdAt",
			${resource.updatedAt} as "updatedAt"
		from page
		left join ${unit} studio_workspace_resource on ${resource.id} = page.unit_id
		left join ${studioResourceVisit} visit
			on visit.profile_id = ${input.profileId}
			and visit.resource_unit_id = page.unit_id
		order by
			page.relevant_at desc nulls last,
			page.unit_id desc nulls last,
			page.source_key desc nulls last
	`);
	return result.rows;
}

function presentCandidate(
	row: RawWorkspaceCandidate,
	section: StudioContentListQuery["section"],
): PresentedWorkspaceCandidate | undefined {
	if (
		!row.accepted ||
		!row.language ||
		!row.status ||
		!row.visibility ||
		row.createdAt === null ||
		row.updatedAt === null
	)
		return undefined;
	const accessSources: StudioAccessSource[] = [];
	const assignedDates: Date[] = [];
	if (row.sourceKind === "profile") {
		if (row.hasOwnerAccess && row.ownerSince !== null) {
			accessSources.push("owner");
			assignedDates.push(dateValue(row.ownerSince, "candidate.ownerSince"));
		}
		if (row.hasDirectAccess && row.directGrantSince !== null) {
			accessSources.push("direct");
			assignedDates.push(dateValue(row.directGrantSince, "candidate.directGrantSince"));
		}
	} else if (row.sourceKind === "realm" && row.hasRealmAccess && row.realmGrantSince !== null) {
		accessSources.push("realm");
		assignedDates.push(dateValue(row.realmGrantSince, "candidate.realmGrantSince"));
	}
	if (!accessSources.length || !assignedDates.length) return undefined;
	const relevantAt = dateValue(row.relevantAt, "candidate.relevantAt");
	return {
		id: row.unitId,
		section,
		language: row.language,
		title: row.title,
		cover: presentImageAsset(row.coverAssetId, "cover"),
		status: row.status,
		visibility: row.visibility,
		accessSources,
		assignedAt: new Date(Math.min(...assignedDates.map((value) => value.getTime()))),
		lastVisitedAt:
			row.lastVisitedAt === null ? null : dateValue(row.lastVisitedAt, "candidate.lastVisitedAt"),
		createdAt: dateValue(row.createdAt, "candidate.createdAt"),
		updatedAt: dateValue(row.updatedAt, "candidate.updatedAt"),
		cursorBoundary: {
			relevantAt,
			unitId: row.unitId,
			sourceKey: row.sourceKey,
		},
	};
}

export async function listStudioContent(input: {
	readonly profileId: string;
	readonly query: StudioContentListQuery;
}) {
	const limit = input.query.limit ?? 30;
	const initialCursor = decodeStudioCursor(input.query.cursor, input.query);
	const source = input.query.source ?? "all";
	const realmSubjects =
		source === "all" || source === "delegated" ? await loadRealmSubjects(input.profileId) : [];
	const items: PresentedWorkspaceCandidate[] = [];
	let scanCursor = initialCursor;
	let scanned = 0;
	let exhausted = false;
	while (items.length < limit + 1 && scanned < StudioCandidateScanBudget && !exhausted) {
		const scanLimit = Math.min(
			StudioCandidateBatchMaximum,
			StudioCandidateScanBudget - scanned,
			Math.max(64, (limit + 1 - items.length) * 3),
		);
		const rows = await selectWorkspaceCandidateBatch({
			profileId: input.profileId,
			query: input.query,
			realmSubjects,
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
				relevantAt: dateValue(row.relevantAt, "candidate.relevantAt"),
				unitId: row.unitId,
				sourceKey: row.sourceKey,
			};
			const item = presentCandidate(row, input.query.section);
			if (item) items.push(item);
			if (items.length >= limit + 1 || scanned >= StudioCandidateScanBudget) break;
		}
		exhausted = rows.length < scanLimit;
	}

	const page = items.slice(0, limit);
	const last = page.at(-1);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(page.map(({ id }) => id));
	const hasMoreAccepted = items.length > limit;
	const nextBoundary = hasMoreAccepted
		? last?.cursorBoundary
		: !exhausted && scanned >= StudioCandidateScanBudget
			? scanCursor
			: undefined;
	return {
		items: page.map(({ cursorBoundary: _cursorBoundary, ...item }) => ({
			...item,
			slugAddress: slugAddresses.get(item.id) ?? null,
		})),
		nextCursor: nextBoundary ? encodeStudioCursor(input.query, nextBoundary) : null,
	};
}

export async function recordStudioVisit(input: {
	readonly profileId: string;
	readonly unitId: string;
	readonly authorization: UnitAuthorization<string>;
}) {
	await input.authorization.ensureCanRead(input.unitId);
	const now = new Date();
	const [visit] = await database
		.insert(studioResourceVisit)
		.values({
			profileId: input.profileId,
			resourceUnitId: input.unitId,
			lastVisitedAt: now,
		})
		.onConflictDoUpdate({
			target: [studioResourceVisit.profileId, studioResourceVisit.resourceUnitId],
			set: { lastVisitedAt: now },
		})
		.returning({
			unitId: studioResourceVisit.resourceUnitId,
			lastVisitedAt: studioResourceVisit.lastVisitedAt,
		});
	if (!visit) throw new Error("Studio visit upsert returned no row");
	return visit;
}
