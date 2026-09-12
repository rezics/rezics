import type { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { readUnitStateById } from "../units/query";
import { UnitNotFound } from "../units/errors";
import {
	CatalogOwnerValues,
	CatalogReferenceSchema,
	UnitOwnerValues,
	type UnitOwner,
} from "@rezics/reference";
import {
	catalogAccessDecisions,
	runWithParticipationAuthority,
	ParticipationDenied,
	type ParticipationAuthority,
} from "../participation/policy";
import { unitStateRelation } from "../units/state-relation";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import { z } from "zod";
import { presentImageAsset } from "../api/image-assets/presentation";
import { and, eq, exists, isNull, not, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { StudioRealmSubjectLimitExceeded } from "../api/users/errors";
import type {
	StudioAccessSource,
	StudioContentListQuery,
	StudioWorkspaceSource,
} from "../api/users/schema";
import type { UnitAuthorization } from "../authorization/unit/authorization";
import {
	getExplicitUnitAnyScopePermissionCondition,
	getUnitReadCondition,
} from "../authorization/unit/query";
import { profileCanManageRealmAccess } from "../authorization/unit/realm-subject";
import { selfAuthUserIdForEntity } from "../participation/account-query";
import { database } from "../database";
import {
	realm,
	users,
	authEntity,
	unitMergeRedirect,
	participationGrant,
	realmMember,
	studioAuthEditorCandidate,
	studioRealmEditorCandidate,
	studioResourceVisit,
	unitAccessGrant,
	unitOwnership,
} from "../database/schema";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import {
	resourceSectionFromReference,
	studioResourceScopeCondition,
	type ResourceSection,
} from "../units/resource-section";

import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
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
	readonly sourceLimitExceeded: boolean;
};

type RawWorkspaceCandidate = {
	readonly unitId: string;
	readonly sourceKind: string;
	readonly sourceKey: string;
	readonly relevantAt: unknown;
	readonly ownerSince: unknown | null;
	readonly catalogCreatorSince: unknown | null;
	readonly catalogGrantSince: unknown | null;
	readonly hasCatalogCreatorAccess: boolean;
	readonly hasCatalogGrantAccess: boolean;
	readonly directGrantSince: unknown | null;
	readonly realmGrantSince: unknown | null;
	readonly lastVisitedAt: unknown | null;
	readonly accepted: boolean;
	readonly hasOwnerAccess: boolean;
	readonly hasDirectAccess: boolean;
	readonly hasRealmAccess: boolean;
	readonly resourceOwner: string | null;
	readonly resourceShape: string | null;
	readonly creatorAuthUserId: string | null;
	readonly language: string | null;
	readonly title: string | null;
	readonly coverAssetId: string | null;
	readonly status: "draft" | "published" | "archived" | null;
	readonly visibility: "public" | "unlisted" | "private" | null;
	readonly createdAt: unknown | null;
	readonly updatedAt: unknown | null;
};

type PresentedWorkspaceCandidate = {
	readonly id: string;
	readonly section: ResourceSection;
	readonly resourceOwner: UnitOwner;
	readonly resourceShape: string;
	readonly language: string | null;
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

function unitOwnerValue(value: string | null): UnitOwner | undefined {
	return UnitOwnerValues.find((owner) => owner === value);
}

/** Loads the small dynamic userset used to seek Realm candidate streams. */
async function loadRealmSubjects(profileId: string): Promise<RealmSubject[]> {
	const managedRealm = alias(realm, "studio_managed_realm_subject");
	const result = await database.execute<RawRealmSubject>(sql`
		with possible_subject as (
			(select member.realm_id, 'member'::text as realm_relation
			from ${realmMember} member
			where member.profile_id = ${profileId}
				and member.state = 'active'
			order by member.realm_id limit 257)

			union all

			(select ownership.unit_realm_id, 'access_manager'
			from ${unitOwnership} ownership
			where ownership.profile_id = ${profileId}
				and ownership.revoked_at is null and ownership.unit_realm_id is not null
			order by ownership.unit_realm_id limit 257)

			union all

			(select access_grant.unit_realm_id, 'access_manager'
			from ${unitAccessGrant} access_grant
			where access_grant.subject_kind = 'auth'
				and access_grant.auth_user_id = ${selfAuthUserIdForEntity(profileId)}
				and access_grant.permission = 'unit.access.manage'
				and cardinality(access_grant.scope) = 0
				and access_grant.revoked_at is null
				and access_grant.unit_realm_id is not null
			order by access_grant.unit_realm_id limit 257)

			union all

			(select delegated.unit_realm_id, 'access_manager'
			from (select realm_id from ${realmMember} where profile_id = ${profileId} and state = 'active' order by realm_id limit 257) member
			cross join lateral (
				select unit_realm_id from ${unitAccessGrant} access_grant
				where access_grant.realm_id = member.realm_id and access_grant.subject_kind = 'realm'
				and access_grant.realm_relation = 'member' and access_grant.permission = 'unit.access.manage'
				and cardinality(access_grant.scope) = 0 and access_grant.revoked_at is null and access_grant.unit_realm_id is not null
				order by access_grant.unit_realm_id limit 257
			) delegated order by delegated.unit_realm_id limit 257)
		)
		select distinct
			(select count(*) > 256 from possible_subject) as "sourceLimitExceeded",
			possible_subject.realm_id as "realmId",
			possible_subject.realm_relation as "realmRelation"
		from possible_subject
		where (select count(*) > 256 from possible_subject) or (exists (
			select 1
			from ${realm}
			where ${realm.id} = possible_subject.realm_id
		)
			and (
				possible_subject.realm_relation = 'member'
			or exists (
					select 1
					from ${realm} studio_managed_realm_subject
					where ${managedRealm.id} = possible_subject.realm_id
						and ${profileCanManageRealmAccess(database, managedRealm.id, profileId)}
				)
			)
		)
		order by possible_subject.realm_id, possible_subject.realm_relation
		limit ${StudioRealmSubjectLimit + 1}
	`);
	if (
		result.rows.length > StudioRealmSubjectLimit ||
		result.rows.some((row) => row.sourceLimitExceeded)
	)
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
			null::timestamptz as catalog_creator_since,
			null::timestamptz as catalog_grant_since,
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
			candidate.catalog_creator_since,
			null::timestamptz as catalog_grant_since,
			candidate.direct_grant_since,
			null::timestamptz as realm_grant_since
		from ${studioAuthEditorCandidate} candidate
		where candidate.auth_user_id = ${selfAuthUserIdForEntity(input.profileId)}
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
	if (input.source === "owned" || input.source === "direct" || input.source === "created")
		return emptyCandidateStream();
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
			null::timestamptz as catalog_creator_since,
			null::timestamptz as catalog_grant_since,
			null::timestamptz as direct_grant_since,
			candidate.grant_since as realm_grant_since
		from realm_subject subject
		cross join lateral (
			select realm_candidate.*
			from ${studioRealmEditorCandidate} realm_candidate
			where realm_candidate.realm_id = subject.realm_id
				and realm_candidate.realm_relation = subject.realm_relation
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

function selectedCatalogGrantStream(input: {
	readonly authority: ParticipationAuthority;
	readonly source: StudioWorkspaceSource;
	readonly cursor?: StudioCursorBoundary;
}): SQL {
	if (!input.authority.grant || (input.source !== "all" && input.source !== "direct"))
		return emptyCandidateStream();
	const target = sql`coalesce(selected_grant.publishing_id,selected_grant.music_id,selected_grant.program_id,selected_grant.software_id,selected_grant.entity_id,selected_grant.grouping_id,selected_grant.reference_id,selected_grant.distribution_id)`;
	const sourceKey = sql`('catalog-grant:' || selected_grant.id::text)`;
	return sql`select ${target} as unit_id, selected_grant.created_at as relevant_at, 'catalog_grant'::text as source_kind,
		${sourceKey} as source_key, null::uuid as realm_id, null::realm_access_subject_relation as realm_relation,
		null::timestamptz as owner_since, null::timestamptz as catalog_creator_since, selected_grant.created_at as catalog_grant_since,
		null::timestamptz as direct_grant_since, null::timestamptz as realm_grant_since
		from ${participationGrant} selected_grant where selected_grant.id = ${input.authority.grant.id} and selected_grant.capability = 'catalog.edit'
		and ${cursorCondition(input.cursor, sql`selected_grant.created_at`, target, sourceKey)} limit 1`;
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
		case "created":
			return sql`false`;
	}
}

async function selectWorkspaceCandidateBatch(input: {
	readonly authUserId: string;
	readonly authority: ParticipationAuthority;
	readonly authorization: UnitAuthorization<string>;
	readonly profileId: string;
	readonly query: StudioContentListQuery;
	readonly realmSubjects: readonly RealmSubject[];
	readonly includeDevelopmentPreview: boolean;
	readonly cursor?: StudioCursorBoundary;
	readonly scanLimit: number;
}): Promise<RawWorkspaceCandidate[]> {
	const source = input.query.source ?? "all";
	const resource = unitStateRelation(sql`page.unit_id`, "studio_workspace_resource");
	const subjectRealm = alias(realm, "studio_workspace_subject_realm");
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
		{ source: { kind: "auth" }, includeOwnership: false },
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
		when page.source_kind = 'profile' and page.catalog_creator_since is not null then ${source === "all" || source === "created"}
		when page.source_kind = 'catalog_grant' then true
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
		or(
			sql`${resource.owner} = any(${sql.param([...CatalogOwnerValues])}::text[])`,
			getUnitReadCondition(input.profileId, {}, resource),
		),
		studioResourceScopeCondition(
			input.query.section,
			{
				owner: resource.owner,
				shape: resource.shape,
			},
			{
				includeDevelopmentPreview: input.includeDevelopmentPreview,
			},
		),
		statusCondition,
		visibilityCondition,
		acceptedSource,
	) as SQL;
	return runWithParticipationAuthority(input.authority, () =>
		database.transaction(async (tx) => {
			const result = await tx.execute<RawWorkspaceCandidate>(sql`
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
			union all
			select * from (${selectedCatalogGrantStream({ authority: input.authority, source, cursor: input.cursor })}) selected_catalog_grant_scan
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
			page.catalog_creator_since as "catalogCreatorSince",
			page.catalog_grant_since as "catalogGrantSince",
			false as "hasCatalogCreatorAccess", false as "hasCatalogGrantAccess",
			page.direct_grant_since as "directGrantSince",
			page.realm_grant_since as "realmGrantSince",
			visit.last_visited_at as "lastVisitedAt",
			${accepted} as accepted,
			${ownerAccess} as "hasOwnerAccess",
			${directAccess} as "hasDirectAccess",
			case when page.source_kind = 'realm' then ${realmAccess} else false end as "hasRealmAccess",
			${resource.owner} as "resourceOwner",
			${resource.shape} as "resourceShape",
			${resource.createdByAuthUserId} as "creatorAuthUserId",
			${resolvedUnitLocalizationLanguage(resource.id, localizationLanguages)} as language,
			${resolvedUnitLocalizationTitle(resource.id, localizationLanguages)} as title,
			${resolvedUnitLocalizationImageAssetId(resource.id, "cover", localizationLanguages)} as "coverAssetId",
			${resource.status} as status,
			${resource.visibility} as visibility,
			${resource.createdAt} as "createdAt",
			${resource.updatedAt} as "updatedAt"
		from page
		left join lateral public.read_unit_state(page.unit_id) studio_workspace_resource on true
		left join ${studioResourceVisit} visit
			on visit.auth_user_id = ${selfAuthUserIdForEntity(input.profileId)}
			and visit.resource_unit_id = page.unit_id
		order by
			page.relevant_at desc nulls last,
			page.unit_id desc nulls last,
			page.source_key desc nulls last
	`);

			const readable = await input.authorization.readableUnitIdsInTransaction(
				tx,
				result.rows.map((row) => row.unitId),
			);
			const native = result.rows.flatMap((row) => {
				const parsed = CatalogReferenceSchema.safeParse({
					owner: row.resourceOwner,
					id: row.unitId,
				});
				return parsed.success
					? [{ reference: parsed.data, createdByAuthUserId: row.creatorAuthUserId }]
					: [];
			});
			const nativeWritable = new Set<string>();
			for (let offset = 0; offset < native.length; offset += 128) {
				const batch = native.slice(offset, offset + 128);
				const decisions = await catalogAccessDecisions(tx, batch, input.authUserId, true);
				batch.forEach((target, index) => {
					if (decisions[index]) nativeWritable.add(target.reference.id);
				});
			}
			const nativeIds = new Set(native.map((target) => target.reference.id));
			const authorized = result.rows.map((row) => {
				if (!nativeIds.has(row.unitId))
					return { ...row, accepted: row.accepted && readable.has(row.unitId) };
				const hasCatalogCreatorAccess =
					!input.authority.grant &&
					input.authority.principal.kind === "auth" &&
					row.creatorAuthUserId === input.authUserId &&
					row.catalogCreatorSince !== null;
				const hasCatalogGrantAccess = row.sourceKind === "catalog_grant";
				return {
					...row,
					hasOwnerAccess: false,
					hasDirectAccess: false,
					hasRealmAccess: false,
					hasCatalogCreatorAccess,
					hasCatalogGrantAccess,
					accepted:
						row.accepted &&
						readable.has(row.unitId) &&
						nativeWritable.has(row.unitId) &&
						((row.sourceKind === "profile" && hasCatalogCreatorAccess) || hasCatalogGrantAccess),
				};
			});
			const presentations = await readUnitPresentationsInTransaction(
				tx,
				authorized.filter((row) => row.accepted).map((row) => row.unitId),
				localizationLanguages,
			);
			return authorized.map((row) =>
				row.accepted
					? {
							...row,
							title: presentations.get(row.unitId)?.title ?? null,
							language: presentations.get(row.unitId)?.language ?? null,
						}
					: row,
			);
		}),
	);
}

function presentCandidate(row: RawWorkspaceCandidate): PresentedWorkspaceCandidate | undefined {
	const resourceOwner = unitOwnerValue(row.resourceOwner);
	if (
		!row.accepted ||
		!resourceOwner ||
		!row.resourceShape ||
		!row.status ||
		!row.visibility ||
		row.createdAt === null ||
		row.updatedAt === null
	)
		return undefined;
	const section = resourceSectionFromReference(resourceOwner, row.resourceShape);
	if (!section) return undefined;
	const accessSources: StudioAccessSource[] = [];
	const assignedDates: Date[] = [];
	if (row.hasCatalogCreatorAccess && row.catalogCreatorSince !== null) {
		accessSources.push("catalog_creator");
		assignedDates.push(dateValue(row.catalogCreatorSince, "candidate.catalogCreatorSince"));
	} else if (row.hasCatalogGrantAccess && row.catalogGrantSince !== null) {
		accessSources.push("catalog_grant");
		assignedDates.push(dateValue(row.catalogGrantSince, "candidate.catalogGrantSince"));
	} else if (row.sourceKind === "profile") {
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
		resourceOwner,
		resourceShape: row.resourceShape,
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
	readonly authUserId: string;
	readonly authority: ParticipationAuthority;
	readonly authorization: UnitAuthorization<string>;
	readonly profileId: string;
	readonly query: StudioContentListQuery;
	readonly includeDevelopmentPreview: boolean;
}) {
	if (
		input.authorization.authUserId !== input.authUserId ||
		input.authorization.profileId !== input.profileId
	)
		throw new ParticipationDenied();
	const limit = input.query.limit ?? 30;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
		throw new RangeError("Studio page limit must be 1..100");
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
			authUserId: input.authUserId,
			authority: input.authority,
			authorization: input.authorization,
			profileId: input.profileId,
			query: input.query,
			realmSubjects,
			includeDevelopmentPreview: input.includeDevelopmentPreview,
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
			const item = presentCandidate(row);
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

/** Record a monotonic private visit under the current Self and target-read authority. @internal */
export async function recordStudioVisit(input: {
	readonly authUserId: string;
	readonly unitId: string;
	readonly authorization: Authorization<string>;
}) {
	const { authorization, authUserId, unitId } = input;
	const authority = authorization.participationAuthority;
	if (
		authorization.authUserId !== authUserId ||
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== authUserId
	)
		throw new ParticipationDenied("Studio visits require the current account's Self authority");
	return database.transaction(async (tx) => {
		const [account] = await tx
			.select({ id: users.id })
			.from(users)
			.where(
				and(eq(users.id, authUserId), eq(users.principalKind, "human"), isNull(users.erasedAt)),
			)
			.limit(1)
			.for("share");
		if (!account) throw new ParticipationDenied("Account is unavailable");
		await ensureAccountAuthenticationAllowed(authUserId, tx);
		await authorization.account.ensureCanWrite(tx);
		const [self] = await tx
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.where(
				and(
					eq(authEntity.authUserId, authUserId),
					eq(authEntity.entityId, authorization.profileId),
					eq(authEntity.state, "active"),
					eq(authEntity.revision, authority.authorizationRevision),
				),
			)
			.limit(1)
			.for("share");
		if (!self) throw new ParticipationDenied("Account Self identity changed");
		await lockUnitAccessState(tx, [unitId], "shared");
		const target = await readUnitStateById(tx, unitId, { lock: "share" });
		if (!target || !(await authorization.unit.decideInTransaction(tx, unitId, "unit.read")).allowed)
			throw new UnitNotFound();
		const [merged] = await tx
			.select({ id: unitMergeRedirect.sourceUnitId })
			.from(unitMergeRedirect)
			.where(eq(unitMergeRedirect.sourceUnitId, unitId))
			.limit(1);
		if (merged) throw new UnitNotFound("Studio resource");
		const [visit] = await tx
			.insert(studioResourceVisit)
			.values({
				authUserId,
				resourceUnitId: unitId,
				lastVisitedAt: sql`clock_timestamp()`,
			})
			.onConflictDoUpdate({
				target: [studioResourceVisit.authUserId, studioResourceVisit.resourceUnitId],
				set: {
					lastVisitedAt: sql`greatest(${studioResourceVisit.lastVisitedAt}, clock_timestamp())`,
				},
			})
			.returning({
				unitId: studioResourceVisit.resourceUnitId,
				lastVisitedAt: studioResourceVisit.lastVisitedAt,
			});
		if (!visit) throw new Error("Studio visit upsert returned no row");
		if (!(await authorization.unit.decideInTransaction(tx, unitId, "unit.read")).allowed)
			throw new UnitNotFound();
		await authorization.account.ensureCanWrite(tx);
		return visit;
	});
}

/** Repairs one owner-local projection page; operators persist the returned PK cursor between transactions. */
export async function repairStudioCatalogCreatorProjection(input: {
	readonly owner: (typeof CatalogOwnerValues)[number];
	readonly afterId?: string;
	readonly limit?: number;
}) {
	const owner = z.enum(CatalogOwnerValues).parse(input.owner);
	const afterId = z.uuid().optional().parse(input.afterId);
	const limit = z
		.number()
		.int()
		.min(1)
		.max(512)
		.parse(input.limit ?? 256);
	return database.transaction(async (tx) => {
		const result = await tx.execute(
			sql`select * from public.repair_studio_catalog_creator_candidates(${owner},${afterId ?? null}::uuid,${limit})`,
		);
		const [page] = z
			.array(
				z.object({
					last_id: z.uuid().nullable(),
					scanned: z.number().int().min(0).max(512),
					exhausted: z.boolean(),
				}),
			)
			.length(1)
			.parse(result.rows);
		if (!page) throw new Error("Studio repair did not return its cursor");
		return { afterId: page.last_id, scanned: page.scanned, exhausted: page.exhausted };
	});
}
