import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import type { UnitAuthorization, UnitAccessDecision } from "../authorization/unit/authorization";
import type { UnitScope } from "../authorization/unit/scope";
import { database } from "../database";
import {
	contentStructure,
	contentStructureNode,
	post,
	realmMember,
	studioResourceVisit,
	studioWorkRelation,
	unit,
	unitAccessGrant,
	unitOwnership,
	type StudioWorkRelation,
} from "../database/schema";
import type {
	StudioAccessSource,
	StudioContentListQuery,
	StudioPermission,
	StudioRelation,
	StudioSection,
	StudioView,
	StudioWorkState,
} from "../api/users/schema";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { presentImageAsset } from "../units/service";
import { decodeStudioCursor, encodeStudioCursor, type StudioCursorBoundary } from "./cursor";
import { resolveStudioResourceUnitId } from "./projection";

const StudioPermissions = [
	"unit.update",
	"unit.status.update",
	"unit.access.manage",
	"unit.realm-publication.manage",
] as const satisfies readonly StudioPermission[];

type CandidateRow = {
	readonly id: string;
	readonly relevantAt: Date;
	readonly lastVisitedAt: Date | null;
	readonly bucket: boolean;
	readonly sortAt: Date;
};

type RawCandidateRow = {
	readonly id: string;
	readonly relevantAt: unknown;
	readonly lastVisitedAt: unknown;
	readonly bucket: boolean;
	readonly sortAt: unknown;
};

type StudioAssignmentRow = {
	readonly id: string;
	readonly resourceUnitId: string;
	readonly authorizationUnitId: string;
	readonly relation: "assigned" | "delegated";
	readonly scope: string[];
	readonly createdAt: Date;
};

type RawStudioAssignmentRow = Omit<StudioAssignmentRow, "createdAt"> & {
	readonly createdAt: unknown;
};

type ActivityRow = {
	readonly resourceUnitId: string;
	readonly authorizationUnitId: string;
	readonly authorizationScope: string[] | null;
	readonly relation: StudioWorkRelation;
	readonly firstAt: Date;
	readonly lastAt: Date;
	readonly activityCount: number;
};

type WorkTarget = {
	readonly authorizationUnitId: string;
	readonly authorizationScope: UnitScope | null;
};

type ResolvedPermission = {
	readonly permission: StudioPermission;
	readonly decision: Extract<UnitAccessDecision, { readonly allowed: true }>;
};

type StudioListAuthorization = Pick<
	UnitAuthorization<string>,
	"canRead" | "decide" | "findAllowedScope"
>;

type PresentedCandidate = {
	readonly id: string;
	readonly section: StudioSection;
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly cover: { readonly id: string; readonly url: string } | null;
	readonly status: "draft" | "published" | "archived";
	readonly visibility: "public" | "unlisted" | "private";
	readonly relations: StudioRelation[];
	readonly workState: StudioWorkState;
	readonly permissions: StudioPermission[];
	readonly accessSources: StudioAccessSource[];
	readonly firstContributedAt: Date | null;
	readonly lastContributedAt: Date | null;
	readonly contributionCount: number;
	readonly assignedAt: Date | null;
	readonly lastVisitedAt: Date | null;
	readonly relevantAt: Date;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly cursorBoundary: StudioCursorBoundary;
};

function toUuidArray(values: readonly string[]): SQL {
	return sql`array[${sql.join(
		values.map((value) => sql`${value}::uuid`),
		sql`, `,
	)}]::uuid[]`;
}

function groupBy<Key, Value>(
	values: readonly Value[],
	keyOf: (value: Value) => Key,
): Map<Key, Value[]> {
	const groups = new Map<Key, Value[]>();
	for (const value of values) {
		const key = keyOf(value);
		const group = groups.get(key);
		if (group) group.push(value);
		else groups.set(key, [value]);
	}
	return groups;
}

function studioSectionCondition(section: StudioSection): SQL {
	switch (section) {
		case "post":
		case "review":
		case "wiki":
			return sql`
				resource.kind = 'post'
				and exists (
					select 1
					from ${post} studio_post
					where studio_post.id = resource.id
						and studio_post.kind = ${section}
				)
			`;
		case "book":
		case "software":
		case "media":
		case "entity":
		case "tag":
		case "realm":
		case "zone":
		case "collection":
		case "poll":
			return sql`resource.kind = ${section}`;
	}
}

function activitySource(profileId: string, view: StudioView): SQL | undefined {
	if (view === "assigned" || view === "delegated") return undefined;
	const relationCondition =
		view === "all"
			? sql`relation.relation in ('created', 'contributed')`
			: sql`relation.relation = ${view}`;
	return sql`
		select relation.resource_unit_id, relation.last_at as relevant_at
		from ${studioWorkRelation} relation
		where relation.profile_id = ${profileId}
			and ${relationCondition}
	`;
}

function directAssignmentSource(profileId: string, view: StudioView): SQL | undefined {
	if (view === "created" || view === "contributed" || view === "delegated") return undefined;
	return sql`
		select
			coalesce(book_owner.owner_unit_id, assignment.unit_id) as resource_unit_id,
			assignment.created_at as relevant_at
		from (
			select ownership.unit_id, ownership.created_at
			from ${unitOwnership} ownership
			where ownership.profile_id = ${profileId}
				and ownership.revoked_at is null
			union all
			select access_grant.unit_id, access_grant.created_at
			from ${unitAccessGrant} access_grant
			where access_grant.subject_kind = 'profile'
				and access_grant.profile_id = ${profileId}
				and access_grant.permission in ('unit.update', 'unit.status.update', 'unit.access.manage', 'unit.realm-publication.manage')
				and access_grant.revoked_at is null
				and (access_grant.expires_at is null or access_grant.expires_at > now())
		) assignment
		left join lateral (
			select distinct structure.owner_unit_id
			from ${contentStructureNode} node
			join ${contentStructure} structure
				on structure.id = node.structure_id
				and structure.owner_unit_id = node.owner_unit_id
			where node.content_unit_id = assignment.unit_id
				and node.deleted_at is null
				and structure.kind = 'book.contents'
				and structure.deleted_at is null
		) book_owner on true
	`;
}

function delegatedAssignmentSource(profileId: string, view: StudioView): SQL | undefined {
	if (view !== "delegated") return undefined;
	return sql`
		select
			coalesce(book_owner.owner_unit_id, access_grant.unit_id) as resource_unit_id,
			access_grant.created_at as relevant_at
		from ${unitAccessGrant} access_grant
		join ${realmMember} member
			on member.realm_id = access_grant.realm_id
			and member.profile_id = ${profileId}
			and member.state = 'active'
		left join lateral (
			select distinct structure.owner_unit_id
			from ${contentStructureNode} node
			join ${contentStructure} structure
				on structure.id = node.structure_id
				and structure.owner_unit_id = node.owner_unit_id
			where node.content_unit_id = access_grant.unit_id
				and node.deleted_at is null
				and structure.kind = 'book.contents'
				and structure.deleted_at is null
		) book_owner on true
		where access_grant.subject_kind = 'realm'
			and access_grant.permission in ('unit.update', 'unit.status.update', 'unit.access.manage', 'unit.realm-publication.manage')
			and access_grant.revoked_at is null
			and (access_grant.expires_at is null or access_grant.expires_at > now())
	`;
}

function candidateSources(profileId: string, view: StudioView): SQL {
	const sources = [
		activitySource(profileId, view),
		directAssignmentSource(profileId, view),
		delegatedAssignmentSource(profileId, view),
	].filter((source): source is SQL => Boolean(source));
	if (!sources.length) throw new Error(`Studio view ${view} has no candidate source`);
	return sql.join(sources, sql` union all `);
}

function candidateSort(sort: NonNullable<StudioContentListQuery["sort"]>) {
	switch (sort) {
		case "recent":
			return {
				bucket: sql`visit.last_visited_at is not null`,
				sortAt: sql`coalesce(visit.last_visited_at, candidate.relevant_at)`,
			};
		case "updated":
			return { bucket: sql`true`, sortAt: sql`resource.updated_at` };
		case "created":
			return { bucket: sql`true`, sortAt: sql`resource.created_at` };
		case "relevant":
			return { bucket: sql`true`, sortAt: sql`candidate.relevant_at` };
	}
}

async function selectCandidateBatch(input: {
	readonly profileId: string;
	readonly query: StudioContentListQuery;
	readonly cursor?: StudioCursorBoundary;
	readonly limit: number;
}): Promise<CandidateRow[]> {
	const view = input.query.view ?? "all";
	const sort = input.query.sort ?? "recent";
	const ordering = candidateSort(sort);
	const cursorCondition = input.cursor
		? sql`
			and (
				(case when ranked.bucket then 1 else 0 end),
				ranked.sort_at,
				ranked.id
			) < (
				${input.cursor.bucket ? 1 : 0},
				${input.cursor.sortAt},
				${input.cursor.unitId}::uuid
			)
		`
		: sql``;
	const statusCondition = input.query.status
		? sql`and resource.status = ${input.query.status}`
		: sql``;
	const visibilityCondition = input.query.visibility
		? sql`and resource.visibility = ${input.query.visibility}`
		: sql``;
	const result = await database.execute<RawCandidateRow>(sql`
		with candidate_event as materialized (
			${candidateSources(input.profileId, view)}
		),
		candidate as materialized (
			select resource_unit_id, max(relevant_at) as relevant_at
			from candidate_event
			group by resource_unit_id
		),
		ranked as (
			select
				resource.id,
				candidate.relevant_at as "relevantAt",
				visit.last_visited_at as "lastVisitedAt",
				${ordering.bucket} as bucket,
				${ordering.sortAt} as sort_at
			from candidate
			join ${unit} resource on resource.id = candidate.resource_unit_id
			left join ${studioResourceVisit} visit
				on visit.profile_id = ${input.profileId}
				and visit.resource_unit_id = resource.id
			where resource.deleted_at is null
				and ${studioSectionCondition(input.query.section)}
				${statusCondition}
				${visibilityCondition}
		)
		select
			ranked.id,
			ranked."relevantAt",
			ranked."lastVisitedAt",
			ranked.bucket,
			ranked.sort_at as "sortAt"
		from ranked
		where true
			${cursorCondition}
		order by ranked.bucket desc, ranked.sort_at desc, ranked.id desc
		limit ${input.limit}
	`);
	return result.rows.map((row) => ({
		id: row.id,
		relevantAt: dateValue(row.relevantAt, "candidate.relevantAt"),
		lastVisitedAt:
			row.lastVisitedAt === null
				? null
				: dateValue(row.lastVisitedAt, "candidate.lastVisitedAt"),
		bucket: row.bucket,
		sortAt: dateValue(row.sortAt, "candidate.sortAt"),
	}));
}

async function loadAssignments(
	profileId: string,
	resourceUnitIds: readonly string[],
): Promise<StudioAssignmentRow[]> {
	if (!resourceUnitIds.length) return [];
	const result = await database.execute<RawStudioAssignmentRow>(sql`
		select
			assignment.id,
			coalesce(book_owner.owner_unit_id, assignment.unit_id) as "resourceUnitId",
			assignment.unit_id as "authorizationUnitId",
			case
				when assignment.subject_kind in ('profile', 'owner') then 'assigned'
				else 'delegated'
			end as relation,
			assignment.scope,
			assignment.created_at as "createdAt"
		from (
			select
				ownership.id,
				ownership.unit_id,
				'owner'::text as subject_kind,
				null::uuid as realm_id,
				array[]::text[] as scope,
				ownership.created_at
			from ${unitOwnership} ownership
			where ownership.profile_id = ${profileId}
				and ownership.revoked_at is null
			union all
			select
				access_grant.id,
				access_grant.unit_id,
				access_grant.subject_kind::text,
				access_grant.realm_id,
				access_grant.scope,
				access_grant.created_at
			from ${unitAccessGrant} access_grant
			where (
					(access_grant.subject_kind = 'profile' and access_grant.profile_id = ${profileId})
					or access_grant.subject_kind = 'realm'
				)
				and access_grant.permission in ('unit.update', 'unit.status.update', 'unit.access.manage', 'unit.realm-publication.manage')
				and access_grant.revoked_at is null
				and (access_grant.expires_at is null or access_grant.expires_at > now())
		) assignment
		left join ${realmMember} member
			on member.realm_id = assignment.realm_id
			and member.profile_id = ${profileId}
			and member.state = 'active'
		left join lateral (
			select distinct structure.owner_unit_id
			from ${contentStructureNode} node
			join ${contentStructure} structure
				on structure.id = node.structure_id
				and structure.owner_unit_id = node.owner_unit_id
			where node.content_unit_id = assignment.unit_id
				and node.deleted_at is null
				and structure.kind = 'book.contents'
				and structure.deleted_at is null
		) book_owner on true
		where (
				(
					assignment.subject_kind in ('profile', 'owner')
				) or (
					assignment.subject_kind = 'realm'
					and member.profile_id is not null
				)
			)
			and coalesce(book_owner.owner_unit_id, assignment.unit_id) = any(
				${toUuidArray(resourceUnitIds)}
			)
	`);
	return result.rows.map((row) => ({
		...row,
		createdAt: dateValue(row.createdAt, "assignment.createdAt"),
	}));
}

function dateValue(value: unknown, field: string): Date {
	const parsed =
		value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
	if (!parsed || Number.isNaN(parsed.getTime()))
		throw new TypeError(`Studio ${field} is not a valid date`);
	return parsed;
}

async function resolvePermission(
	authorization: StudioListAuthorization,
	target: WorkTarget,
	permission: StudioPermission,
): Promise<ResolvedPermission | undefined> {
	const scope =
		target.authorizationScope ??
		(await authorization.findAllowedScope(target.authorizationUnitId, permission));
	if (scope === undefined) return undefined;
	const decision = await authorization.decide(target.authorizationUnitId, permission, scope);
	return decision.allowed ? { permission, decision } : undefined;
}

function permissionSource(decision: ResolvedPermission["decision"]): StudioAccessSource {
	if (decision.source === "platform") return "platform";
	if (decision.source === "owner") return "direct";
	if (decision.source === "grant")
		return decision.subjectKind === "profile"
			? "direct"
			: decision.subjectKind === "realm"
				? "realm"
				: "authenticated";
	throw new Error("Studio write permission cannot be public");
}

function relationMatchesView(relations: readonly StudioRelation[], view: StudioView): boolean {
	if (view === "all")
		return relations.some(
			(relation) =>
				relation === "created" || relation === "contributed" || relation === "assigned",
		);
	return relations.includes(view);
}

async function presentCandidate(input: {
	readonly authorization: StudioListAuthorization;
	readonly query: StudioContentListQuery;
	readonly candidate: CandidateRow;
	readonly activities: readonly ActivityRow[];
	readonly assignments: readonly StudioAssignmentRow[];
}): Promise<PresentedCandidate | undefined> {
	if (!(await input.authorization.canRead(input.candidate.id))) return undefined;
	const localizationLanguages = input.query.localizationLanguages ?? [];
	const [resource] = await database
		.select({
			id: unit.id,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"cover",
				localizationLanguages,
			),
			status: unit.status,
			visibility: unit.visibility,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(unit)
		.where(and(eq(unit.id, input.candidate.id), isNull(unit.deletedAt)))
		.limit(1);
	if (!resource || !resource.language) return undefined;

	const relations = new Set<StudioRelation>();
	for (const activity of input.activities) relations.add(activity.relation);
	if (input.assignments.some((assignment) => assignment.relation === "assigned"))
		relations.add("assigned");
	if (input.assignments.some((assignment) => assignment.relation === "delegated"))
		relations.add("delegated");
	const relationValues = [...relations];
	const view = input.query.view ?? "all";
	if (!relationMatchesView(relationValues, view)) return undefined;

	const targets = new Map<string, WorkTarget>();
	for (const activity of input.activities) {
		const scopeKey = activity.authorizationScope?.join("/") ?? "*";
		targets.set(`${activity.authorizationUnitId}:${scopeKey}`, {
			authorizationUnitId: activity.authorizationUnitId,
			authorizationScope: activity.authorizationScope,
		});
	}
	for (const assignment of input.assignments)
		targets.set(`${assignment.authorizationUnitId}:${assignment.scope.join("/")}`, {
			authorizationUnitId: assignment.authorizationUnitId,
			authorizationScope: assignment.scope,
		});

	const resolvedPermissions: ResolvedPermission[] = [];
	for (const permission of StudioPermissions) {
		for (const target of targets.values()) {
			const resolved = await resolvePermission(input.authorization, target, permission);
			if (resolved) {
				resolvedPermissions.push(resolved);
				break;
			}
		}
	}
	const permissions = resolvedPermissions.map(({ permission }) => permission);
	const workState: StudioWorkState = permissions.length ? "actionable" : "blocked";
	if (input.query.permission && !permissions.includes(input.query.permission)) return undefined;
	if (input.query.workState && input.query.workState !== workState) return undefined;

	const contributed = input.activities.filter((activity) => activity.relation === "contributed");
	const assigned = input.assignments.filter((assignment) => assignment.relation === "assigned");
	const accessSources = new Set<StudioAccessSource>();
	if (assigned.length) accessSources.add("direct");
	if (input.assignments.some((assignment) => assignment.relation === "delegated"))
		accessSources.add("realm");
	for (const permission of resolvedPermissions)
		accessSources.add(permissionSource(permission.decision));

	return {
		id: resource.id,
		section: input.query.section,
		language: resource.language,
		title: resource.title,
		cover: presentImageAsset(resource.coverAssetId, "cover"),
		status: resource.status,
		visibility: resource.visibility,
		relations: relationValues,
		workState,
		permissions,
		accessSources: [...accessSources],
		firstContributedAt: contributed.length
			? new Date(Math.min(...contributed.map(({ firstAt }) => firstAt.getTime())))
			: null,
		lastContributedAt: contributed.length
			? new Date(Math.max(...contributed.map(({ lastAt }) => lastAt.getTime())))
			: null,
		contributionCount: contributed.reduce(
			(total, activity) => total + activity.activityCount,
			0,
		),
		assignedAt: assigned.length
			? new Date(Math.min(...assigned.map(({ createdAt }) => createdAt.getTime())))
			: null,
		lastVisitedAt: input.candidate.lastVisitedAt,
		relevantAt: input.candidate.relevantAt,
		createdAt: resource.createdAt,
		updatedAt: resource.updatedAt,
		cursorBoundary: {
			bucket: input.candidate.bucket,
			sortAt: input.candidate.sortAt,
			unitId: resource.id,
		},
	};
}

export async function listStudioContent(input: {
	readonly profileId: string;
	readonly authorization: StudioListAuthorization;
	readonly query: StudioContentListQuery;
}) {
	const limit = input.query.limit ?? 50;
	const initialCursor = decodeStudioCursor(input.query.cursor, input.query);
	const items: PresentedCandidate[] = [];
	let scanCursor = initialCursor;
	let exhausted = false;
	while (items.length < limit + 1 && !exhausted) {
		const batchLimit = Math.max(50, (limit + 1 - items.length) * 2);
		const candidates = await selectCandidateBatch({
			profileId: input.profileId,
			query: input.query,
			cursor: scanCursor,
			limit: batchLimit,
		});
		if (!candidates.length) break;
		const candidateIds = candidates.map(({ id }) => id);
		const [activities, assignments] = await Promise.all([
			database
				.select({
					resourceUnitId: studioWorkRelation.resourceUnitId,
					authorizationUnitId: studioWorkRelation.authorizationUnitId,
					authorizationScope: studioWorkRelation.authorizationScope,
					relation: studioWorkRelation.relation,
					firstAt: studioWorkRelation.firstAt,
					lastAt: studioWorkRelation.lastAt,
					activityCount: studioWorkRelation.activityCount,
				})
				.from(studioWorkRelation)
				.where(
					and(
						eq(studioWorkRelation.profileId, input.profileId),
						inArray(studioWorkRelation.resourceUnitId, candidateIds),
					),
				),
			loadAssignments(input.profileId, candidateIds),
		]);
		const activityByResource = groupBy(activities, ({ resourceUnitId }) => resourceUnitId);
		const assignmentByResource = groupBy(assignments, ({ resourceUnitId }) => resourceUnitId);
		for (const candidate of candidates) {
			const item = await presentCandidate({
				authorization: input.authorization,
				query: input.query,
				candidate,
				activities: activityByResource.get(candidate.id) ?? [],
				assignments: assignmentByResource.get(candidate.id) ?? [],
			});
			if (item) items.push(item);
			if (items.length >= limit + 1) break;
		}
		const lastScanned = candidates.at(-1);
		if (!lastScanned) break;
		scanCursor = {
			bucket: lastScanned.bucket,
			sortAt: lastScanned.sortAt,
			unitId: lastScanned.id,
		};
		exhausted = candidates.length < batchLimit;
	}

	const page = items.slice(0, limit);
	const last = page.at(-1);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(page.map(({ id }) => id));
	return {
		items: page.map(({ cursorBoundary: _cursorBoundary, ...item }) => ({
			...item,
			slugAddress: slugAddresses.get(item.id) ?? null,
		})),
		nextCursor:
			items.length > limit && last
				? encodeStudioCursor(input.query, last.cursorBoundary)
				: null,
	};
}

export async function recordStudioVisit(input: {
	readonly profileId: string;
	readonly unitId: string;
	readonly authorization: UnitAuthorization<string>;
}) {
	await input.authorization.ensureCanRead(input.unitId);
	const resourceUnitId = await resolveStudioResourceUnitId(database, input.unitId);
	if (resourceUnitId !== input.unitId) await input.authorization.ensureCanRead(resourceUnitId);
	const now = new Date();
	const [visit] = await database
		.insert(studioResourceVisit)
		.values({
			profileId: input.profileId,
			resourceUnitId,
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
