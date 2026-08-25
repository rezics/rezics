import { Client, type QueryResultRow } from "pg";

import { ContentLabelRegistryManifest } from "../src/services/bootstrap/data/content-labels";
import { OfficialProfileIds } from "../src/services/bootstrap/data/foundation";
import type { UnitStructureCorrectionJob } from "../src/services/tag-structures/correction";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const Timestamp = "2026-08-23T14:00:00.000Z";
const LocalDatabaseHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const OfficialAuthUserId = "7b000000-0000-7000-8000-000000000001";
const OfficialEditorialAuthUserId = "7b000000-0000-7000-8000-000000000005";
const AuthUserIds = [
	"7b000000-0000-7000-8000-000000000002",
	"7b000000-0000-7000-8000-000000000003",
	"7b000000-0000-7000-8000-000000000004",
] as const;
const ProfileIds = [
	"7b000000-0000-7000-8000-000000000011",
	"7b000000-0000-7000-8000-000000000012",
	"7b000000-0000-7000-8000-000000000013",
] as const;

const TargetUnitId = "7b000000-0000-7000-8000-000000000101";
const DraftUnitId = "7b000000-0000-7000-8000-000000000102";
const ContextPostId = "7b000000-0000-7000-8000-000000000103";
const RealmId = "7b000000-0000-7000-8000-000000000104";
const EntityId = "7b000000-0000-7000-8000-000000000105";

const TagAId = "7b000000-0000-7000-8000-000000000111";
const TagBId = "7b000000-0000-7000-8000-000000000112";
const TagCId = "7b000000-0000-7000-8000-000000000113";
const TagDId = "7b000000-0000-7000-8000-000000000114";
const TagEId = "7b000000-0000-7000-8000-000000000115";
const DirectTagId = "7b000000-0000-7000-8000-000000000116";
const RealmTagId = "7b000000-0000-7000-8000-000000000117";
const NonDirectTagId = "7b000000-0000-7000-8000-000000000118";

const PathOneId = "7b000000-0000-7000-8000-000000000121";
const PathTwoId = "7b000000-0000-7000-8000-000000000122";
const DuplicatePathId = "7b000000-0000-7000-8000-000000000123";
const RuleId = "7b000000-0000-7000-8000-000000000130";
const RuleRevisionId = "7b000000-0000-7000-8000-000000000131";

const MeasurementContextIds = [
	"7b000000-0000-7000-8000-000000000201",
	"7b000000-0000-7000-8000-000000000202",
	"7b000000-0000-7000-8000-000000000203",
	"7b000000-0000-7000-8000-000000000204",
	"7b000000-0000-7000-8000-000000000205",
	"7b000000-0000-7000-8000-000000000206",
	"7b000000-0000-7000-8000-000000000207",
	"7b000000-0000-7000-8000-000000000208",
	"7b000000-0000-7000-8000-000000000209",
] as const;

const SubjectAssociationId = "7b000000-0000-7000-8000-000000000301";
const ContentLabelApplyDecisionId = "7b000000-0000-7000-8000-000000000401";
const ContentLabelReplaceDecisionId = "7b000000-0000-7000-8000-000000000402";
const ContentLabelRemoveDecisionId = "7b000000-0000-7000-8000-000000000403";
const ContentLabelReapplyDecisionId = "7b000000-0000-7000-8000-000000000404";
const CorrectionCapabilityGrantId = "7b000000-0000-7000-8000-000000000501";

const ContentSpoilerMinorId = ContentLabelRegistryManifest[1].id;
const NsfwLabelId = ContentLabelRegistryManifest[3].id;

const FixtureAuthUserIds = [
	OfficialAuthUserId,
	OfficialEditorialAuthUserId,
	...AuthUserIds,
] as const;
const FixtureUnitIds = [
	OfficialProfileIds.moderation,
	OfficialProfileIds.editorial,
	...ProfileIds,
	TargetUnitId,
	DraftUnitId,
	ContextPostId,
	RealmId,
	EntityId,
	TagAId,
	TagBId,
	TagCId,
	TagDId,
	TagEId,
	DirectTagId,
	RealmTagId,
	NonDirectTagId,
	PathOneId,
	PathTwoId,
	DuplicatePathId,
	RuleId,
	...MeasurementContextIds,
	...ContentLabelRegistryManifest.map(({ id }) => id),
] as const;

const CorrectionStatusSequence = [
	"pending",
	"preflighting",
	"staging",
	"reconciling",
	"ready",
	"activating",
	"active_overlay",
	"compacting",
	"route_switching",
	"cleaning",
	"completed",
] as const satisfies readonly UnitStructureCorrectionJob["status"][];
const MaximumCorrectionDispatchSteps = 4_096;

interface AggregateRow extends QueryResultRow {
	readonly major: string;
	readonly minor: string;
	readonly none: string;
	readonly score: string;
	readonly spoilerCount: string;
	readonly voteCount: string;
}

interface SubjectAggregateRow extends QueryResultRow {
	readonly major: string;
	readonly minor: string;
	readonly none: string;
	readonly spoilerCount: string;
}

interface CorrectionRuntime {
	readonly dispatch: typeof import("../src/services/tag-structures/correction-worker").dispatchUnitStructureCorrectionJobs;
	readonly get: typeof import("../src/services/tag-structures/correction").getUnitStructureCorrection;
}

type CorrectionStatus = UnitStructureCorrectionJob["status"];

interface DatabaseErrorExpectation {
	readonly code: string;
	readonly constraint?: string;
}

let savepointSequence = 0;

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function databaseErrorField(error: unknown, field: "code" | "constraint"): string | undefined {
	return isRecord(error) && typeof error[field] === "string" ? error[field] : undefined;
}

async function expectDatabaseError(
	client: Client,
	operation: () => Promise<unknown>,
	expected: DatabaseErrorExpectation,
	message: string,
): Promise<void> {
	const savepoint = `vndb_v11_expected_${++savepointSequence}`;
	await client.query(`savepoint ${savepoint}`);
	try {
		await operation();
	} catch (error) {
		await client.query(`rollback to savepoint ${savepoint}`);
		await client.query(`release savepoint ${savepoint}`);
		const code = databaseErrorField(error, "code");
		const constraint = databaseErrorField(error, "constraint");
		assert(
			code === expected.code,
			`${message}; expected PostgreSQL ${expected.code}, received ${code ?? "no code"}`,
		);
		if (expected.constraint)
			assert(
				constraint === expected.constraint,
				`${message}; expected constraint ${expected.constraint}, received ${constraint ?? "none"}`,
			);
		return;
	}
	await client.query(`rollback to savepoint ${savepoint}`);
	await client.query(`release savepoint ${savepoint}`);
	throw new Error(`${message}; operation unexpectedly succeeded`);
}

async function queryOne<Row extends QueryResultRow>(
	client: Client,
	text: string,
	values: readonly unknown[] = [],
): Promise<Row> {
	const result = await client.query<Row>(text, [...values]);
	const row = result.rows[0];
	assert(row, "Expected the database query to return one row");
	return row;
}

function assertAggregate(
	row: AggregateRow,
	expected: {
		readonly major: number;
		readonly minor: number;
		readonly none: number;
		readonly score: number;
		readonly spoilerCount: number;
		readonly voteCount: number;
	},
	message: string,
): void {
	assert(
		row.score === String(expected.score) &&
			row.voteCount === String(expected.voteCount) &&
			row.spoilerCount === String(expected.spoilerCount) &&
			row.none === String(expected.none) &&
			row.minor === String(expected.minor) &&
			row.major === String(expected.major),
		`${message}; received ${JSON.stringify(row)}`,
	);
	assert(
		(expected.voteCount + expected.score) % 2 === 0,
		`${message}; expected fit aggregate must preserve vote/score parity`,
	);
	assert(
		expected.spoilerCount === expected.none + expected.minor + expected.major,
		`${message}; expected spoiler aggregate must preserve the full distribution`,
	);
}

function assertSubjectAggregate(
	row: SubjectAggregateRow,
	expected: { readonly major: number; readonly minor: number; readonly none: number },
	message: string,
): void {
	const spoilerCount = expected.none + expected.minor + expected.major;
	assert(
		row.spoilerCount === String(spoilerCount) &&
			row.none === String(expected.none) &&
			row.minor === String(expected.minor) &&
			row.major === String(expected.major),
		`${message}; received ${JSON.stringify(row)}`,
	);
}

async function assertDisposableDatabase(client: Client, connectionString: string): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes destructive fixtures`,
	);
	let url: URL;
	try {
		url = new URL(connectionString);
	} catch {
		throw new Error("DATABASE_ADMIN_URL must be a valid PostgreSQL URL");
	}
	assert(
		url.protocol === "postgres:" || url.protocol === "postgresql:",
		"DATABASE_ADMIN_URL must use the PostgreSQL protocol",
	);
	assert(
		LocalDatabaseHosts.has(url.hostname),
		"VNDB v11 contract fixtures may run only through a localhost database URL",
	);
	const result = await queryOne<{ readonly database: string }>(
		client,
		"select current_database() as database",
	);
	assert(
		result.database === "rezics_atlas",
		"VNDB v11 contract fixtures may run only in the disposable rezics_atlas database",
	);
}

async function assertFixtureAbsent(client: Client): Promise<void> {
	const unitResult = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from public.unit where id = any($1::uuid[])",
		[FixtureUnitIds],
	);
	assert(unitResult.count === "0", "VNDB v11 Unit fixtures were not fully cleaned");
	const userResult = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from public.users where id = any($1::uuid[])",
		[FixtureAuthUserIds],
	);
	assert(userResult.count === "0", "VNDB v11 auth fixtures were not fully cleaned");
}

async function seedOwnersAndUnits(client: Client): Promise<void> {
	const owners = [
		{
			authUserId: OfficialEditorialAuthUserId,
			profileId: OfficialProfileIds.editorial,
			name: "VNDB fixture editorial",
			email: "vndb-fixture-editorial@example.invalid",
		},
		{
			authUserId: OfficialAuthUserId,
			profileId: OfficialProfileIds.moderation,
			name: "VNDB fixture moderation",
			email: "vndb-fixture-moderation@example.invalid",
		},
		...ProfileIds.map((profileId, index) => ({
			authUserId: AuthUserIds[index],
			profileId,
			name: `VNDB fixture profile ${index + 1}`,
			email: `vndb-fixture-${index + 1}@example.invalid`,
		})),
	];
	for (const owner of owners) {
		assert(owner.authUserId, `Missing auth fixture for Profile ${owner.profileId}`);
		await client.query(
			`insert into public.users (
				id, name, email, email_verified, registration_content_language, created_at, updated_at
			) values ($1, $2, $3, true, 'en', $4, $4)`,
			[owner.authUserId, owner.name, owner.email, Timestamp],
		);
	}

	const unitRows: readonly {
		readonly id: string;
		readonly kind: string;
		readonly status?: "draft" | "published";
	}[] = [
		{ id: OfficialProfileIds.moderation, kind: "profile", status: "published" },
		{ id: OfficialProfileIds.editorial, kind: "profile", status: "published" },
		...ProfileIds.map((id) => ({ id, kind: "profile", status: "published" as const })),
		{ id: TargetUnitId, kind: "book", status: "published" },
		{ id: DraftUnitId, kind: "book", status: "draft" },
		{ id: ContextPostId, kind: "post", status: "published" },
		{ id: RealmId, kind: "realm", status: "published" },
		{ id: EntityId, kind: "entity", status: "published" },
		{ id: TagAId, kind: "tag", status: "published" },
		{ id: TagBId, kind: "tag", status: "published" },
		{ id: TagCId, kind: "tag", status: "published" },
		{ id: TagDId, kind: "tag", status: "published" },
		{ id: TagEId, kind: "tag", status: "published" },
		{ id: DirectTagId, kind: "tag", status: "published" },
		{ id: RealmTagId, kind: "tag", status: "published" },
		{ id: NonDirectTagId, kind: "tag", status: "published" },
		{ id: PathOneId, kind: "structure", status: "published" },
		{ id: PathTwoId, kind: "structure", status: "published" },
		{ id: DuplicatePathId, kind: "structure", status: "published" },
		{ id: RuleId, kind: "realm_rule", status: "published" },
		...MeasurementContextIds.map((id) => ({
			id,
			kind: "release",
			status: "published" as const,
		})),
		...ContentLabelRegistryManifest.map(({ id }) => ({
			id,
			kind: "tag",
			status: "published" as const,
		})),
	];
	for (const row of unitRows) {
		const status = row.status ?? "published";
		await client.query(
			`insert into public.unit (
				id, kind, status, visibility, moderation_status, published_at, created_at, updated_at
			) values ($1, $2, $3, 'public', 'approved', $4, $5, $5)`,
			[row.id, row.kind, status, status === "published" ? Timestamp : null, Timestamp],
		);
	}

	for (const owner of owners)
		await client.query(
			`insert into public.profile (id, auth_user_id, joined_at, created_at, updated_at)
			values ($1, $2, $3, $3, $3)`,
			[owner.profileId, owner.authUserId, Timestamp],
		);

	await client.query("insert into public.post (id, kind) values ($1, 'wiki')", [ContextPostId]);
	await client.query("insert into public.realm (id, realm_tag_voting_enabled) values ($1, false)", [
		RealmId,
	]);
	await client.query("insert into public.entity (id, kind) values ($1, 'character')", [EntityId]);

	const ordinaryTags = [TagAId, TagBId, TagCId, TagDId, TagEId, DirectTagId, RealmTagId];
	for (const tagId of ordinaryTags)
		await client.query(
			`insert into public.tag (id, directly_applicable, default_spoiler_level)
			values ($1, true, $2)`,
			[tagId, tagId === TagAId ? 1 : null],
		);
	await client.query("insert into public.tag (id, directly_applicable) values ($1, false)", [
		NonDirectTagId,
	]);
	for (const label of ContentLabelRegistryManifest)
		await client.query("insert into public.tag (id, directly_applicable) values ($1, false)", [
			label.id,
		]);
}

async function seedRelationships(client: Client): Promise<void> {
	await client.query(
		`insert into public.realm_unit (realm_id, unit_id)
		values ($1, $2), ($1, $3)`,
		[RealmId, TargetUnitId, ContextPostId],
	);
	await client.query(
		`insert into public.realm_tag_context (
			realm_id, tag_id, context_post_id, created_by_profile_id
		) values ($1, $2, $3, $4)`,
		[RealmId, RealmTagId, ContextPostId, ProfileIds[0]],
	);
	await client.query(
		`insert into public.subject_association (
			id, unit_id, entity_id, role, position, created_at, updated_at
		) values ($1, $2, $3, 'appears', 'a0', $4, $4)`,
		[SubjectAssociationId, TargetUnitId, EntityId, Timestamp],
	);

	for (const tagId of [TagAId, TagBId, TagCId, DirectTagId, RealmTagId])
		await client.query(
			`insert into public.unit_tag (
				unit_id, tag_id, created_by_profile_id, pinned, position, created_at, updated_at
			) values ($1, $2, $3, false, null, $4, $4)`,
			[TargetUnitId, tagId, ProfileIds[0], Timestamp],
		);

	await client.query(
		`insert into public.unit_structure (
			id, kind, definition_version, member_unit_ids, created_by_profile_id, created_at, updated_at
		) values
			($1, 'tag.hierarchy_path', 1, $2::uuid[], $4, $5, $5),
			($3, 'tag.hierarchy_path', 1, $6::uuid[], $4, $5, $5)`,
		[
			PathOneId,
			[TagAId, TagBId, TagCId],
			PathTwoId,
			ProfileIds[0],
			Timestamp,
			[TagDId, TagBId, TagCId],
		],
	);
	await client.query(
		`insert into public.unit_structure_application (
			unit_id, structure_id, created_by_profile_id, pinned, position, created_at, updated_at
		) values ($1, $2, $3, false, null, $4, $4)`,
		[TargetUnitId, PathOneId, ProfileIds[0], Timestamp],
	);

	await client.query(
		`insert into public.realm_rule_revision (
			id, realm_id, version, created_by_profile_id, published_at
		) values ($1, $2, 1, $3, $4)`,
		[RuleRevisionId, RealmId, OfficialProfileIds.moderation, Timestamp],
	);
	await client.query(
		"insert into public.realm_rule (id, revision_id, position, created_at) values ($1, $2, 0, $3)",
		[RuleId, RuleRevisionId, Timestamp],
	);
}

async function readUnitTagAggregate(client: Client, tagId: string): Promise<AggregateRow> {
	return queryOne<AggregateRow>(
		client,
		`select
			score::text as score,
			vote_count::text as "voteCount",
			spoiler_vote_count::text as "spoilerCount",
			spoiler_none_count::text as none,
			spoiler_minor_count::text as minor,
			spoiler_major_count::text as major
		from public.current_unit_tag_judgment_stat
		where unit_id = $1 and tag_id = $2`,
		[TargetUnitId, tagId],
	);
}

async function readPathAggregate(client: Client): Promise<AggregateRow> {
	return queryOne<AggregateRow>(
		client,
		`select
			score::text as score,
			vote_count::text as "voteCount",
			spoiler_vote_count::text as "spoilerCount",
			spoiler_none_count::text as none,
			spoiler_minor_count::text as minor,
			spoiler_major_count::text as major
		from public.unit_structure_application_judgment_stat
		where unit_id = $1 and structure_id = $2`,
		[TargetUnitId, PathOneId],
	);
}

async function readRealmAggregate(client: Client): Promise<AggregateRow> {
	return queryOne<AggregateRow>(
		client,
		`select
			score::text as score,
			vote_count::text as "voteCount",
			spoiler_vote_count::text as "spoilerCount",
			spoiler_none_count::text as none,
			spoiler_minor_count::text as minor,
			spoiler_major_count::text as major
		from public.realm_tag_judgment_stat
		where realm_id = $1 and unit_id = $2 and tag_id = $3`,
		[RealmId, TargetUnitId, RealmTagId],
	);
}

async function readSubjectAggregate(client: Client): Promise<SubjectAggregateRow> {
	return queryOne<SubjectAggregateRow>(
		client,
		`select
			spoiler_vote_count::text as "spoilerCount",
			spoiler_none_count::text as none,
			spoiler_minor_count::text as minor,
			spoiler_major_count::text as major
		from public.subject_association_judgment_stat
		where association_id = $1`,
		[SubjectAssociationId],
	);
}

async function verifyPathDefinitions(client: Client): Promise<void> {
	const members = await client.query<{
		readonly memberId: string;
		readonly ordinal: number;
		readonly projectionVersion: number;
	}>(
		`select projection_version as "projectionVersion", ordinal, member_unit_id as "memberId"
		from public.current_unit_structure_member
		where structure_id = $1
		order by ordinal`,
		[PathOneId],
	);
	assert(
		members.rows.map(({ memberId }) => memberId).join(",") === [TagAId, TagBId, TagCId].join(",") &&
			members.rows.map(({ ordinal }) => ordinal).join(",") === "0,1,2" &&
			members.rows.every(({ projectionVersion }) => projectionVersion === 1),
		"Path members must be an exact ordered projection",
	);
	const edges = await client.query<{
		readonly childId: string;
		readonly ordinal: number;
		readonly parentId: string;
		readonly projectionVersion: number;
	}>(
		`select projection_version as "projectionVersion", ordinal,
			parent_unit_id as "parentId", child_unit_id as "childId"
		from public.current_unit_structure_edge
		where structure_id = $1
		order by ordinal`,
		[PathOneId],
	);
	assert(
		edges.rows.length === 2 &&
			edges.rows[0]?.ordinal === 0 &&
			edges.rows[0]?.parentId === TagAId &&
			edges.rows[0]?.childId === TagBId &&
			edges.rows[0]?.projectionVersion === 1 &&
			edges.rows[1]?.ordinal === 1 &&
			edges.rows[1]?.parentId === TagBId &&
			edges.rows[1]?.childId === TagCId &&
			edges.rows[1]?.projectionVersion === 1,
		"Path edges must project only adjacent ordered members",
	);

	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_structure (
					id, kind, definition_version, member_unit_ids, created_by_profile_id
				) values ($1, 'tag.hierarchy_path', 1, $2::uuid[], $3)`,
				[DuplicatePathId, [TagAId, TagBId, TagCId], ProfileIds[0]],
			),
		{ code: "23505", constraint: "unit_structure_definition_key" },
		"Exact Path arrays must deduplicate at the database boundary",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_structure (
					id, kind, definition_version, member_unit_ids, created_by_profile_id
				) values ($1, 'tag.hierarchy_path', 1, $2::uuid[], $3)`,
				[DuplicatePathId, [TagAId, ContentSpoilerMinorId], ProfileIds[0]],
			),
		{ code: "23514", constraint: "content_label_hierarchy_member_rejected" },
		"Content-label registry identities must never enter hierarchy Paths",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				"update public.unit_structure_end set final_tag_id = $1 where structure_id = $2",
				[TagEId, PathOneId],
			),
		{ code: "55000" },
		"Path end projections must reject direct mutation",
	);

	await client.query(
		`insert into public.unit_structure_vote (structure_id, profile_id, value)
		values ($1, $2, 1)`,
		[PathOneId, ProfileIds[0]],
	);
	let primary = await queryOne<{
		readonly structureId: string;
		readonly structureProjectionVersion: number;
	}>(
		client,
		`select structure_id as "structureId",
			structure_projection_version as "structureProjectionVersion"
		from public.current_tag_primary_display_path where tag_id = $1`,
		[TagCId],
	);
	assert(
		primary.structureId === PathOneId && primary.structureProjectionVersion === 1,
		"One accepted ending Path generation must become primary",
	);

	await client.query(
		`insert into public.unit_structure_vote (structure_id, profile_id, value)
		values ($1, $3, 1), ($1, $2, 1)`,
		[PathTwoId, ProfileIds[0], ProfileIds[1]],
	);
	primary = await queryOne<{
		readonly structureId: string;
		readonly structureProjectionVersion: number;
	}>(
		client,
		`select structure_id as "structureId",
			structure_projection_version as "structureProjectionVersion"
		from public.current_tag_primary_display_path where tag_id = $1`,
		[TagCId],
	);
	assert(
		primary.structureId === PathTwoId && primary.structureProjectionVersion === 1,
		"Primary Path refresh must select the stronger accepted definition",
	);
	const pathVoteStat = await queryOne<{ readonly score: string; readonly voteCount: string }>(
		client,
		`select score::text as score, vote_count::text as "voteCount"
		from public.unit_structure_vote_stat where structure_id = $1`,
		[PathTwoId],
	);
	assert(
		pathVoteStat.score === "2" && pathVoteStat.voteCount === "2",
		"Definition-vote aggregate must preserve exact score and parity",
	);
	const candidate = await queryOne<{
		readonly accepted: boolean;
		readonly finalTagId: string;
		readonly projectionVersion: number;
		readonly score: string;
		readonly voteCount: string;
		readonly wilsonLowerBound: number;
	}>(
		client,
		`select
			projection_version as "projectionVersion",
			final_tag_id as "finalTagId",
			accepted,
			wilson_lower_bound as "wilsonLowerBound",
			score::text as score,
			vote_count::text as "voteCount"
		from public.current_unit_structure_primary_path_candidate
		where structure_id = $1`,
		[PathTwoId],
	);
	assert(
		candidate.projectionVersion === 1 &&
			candidate.finalTagId === TagCId &&
			candidate.accepted &&
			candidate.wilsonLowerBound > 0 &&
			candidate.score === "2" &&
			candidate.voteCount === "2",
		"The current primary-Path candidate must retain its exact rank tuple",
	);

	await expectDatabaseError(
		client,
		() =>
			client.query(
				`update public.unit_structure
				set member_unit_ids = $1::uuid[], updated_at = $2
				where id = $3`,
				[[TagDId, TagBId, TagEId], Timestamp, PathTwoId],
			),
		{ code: "55000" },
		"Path definitions must reject direct mutation outside the durable correction job",
	);
	const correctedEnd = await queryOne<{
		readonly finalTagId: string;
		readonly projectionVersion: number;
	}>(
		client,
		`select projection_version as "projectionVersion", final_tag_id as "finalTagId"
		from public.current_unit_structure_end where structure_id = $1`,
		[PathTwoId],
	);
	assert(
		correctedEnd.projectionVersion === 1 && correctedEnd.finalTagId === TagCId,
		"A rejected direct mutation changed the active Path generation",
	);
}

async function verifyDirectJudgments(client: Client): Promise<void> {
	await client.query(
		`insert into public.unit_tag_judgment (
			unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values
			($1, $2, $3, 1, 2, $6, $6, $6, $6),
			($1, $2, $4, -1, null, $6, null, $6, $6),
			($1, $2, $5, null, 1, null, $6, $6, $6)`,
		[TargetUnitId, DirectTagId, ...ProfileIds, Timestamp],
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: 0, voteCount: 2, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Direct Tag judgment aggregate mismatch",
	);

	await client.query(
		"create temporary table vndb_v11_stat_write_observation (operation text not null) on commit drop",
	);
	await client.query(`create function pg_temp.observe_vndb_v11_stat_write() returns trigger
		language plpgsql as $$
		begin
			insert into pg_temp.vndb_v11_stat_write_observation (operation) values (TG_OP);
			return null;
		end;
		$$`);
	await client.query(
		`create trigger vndb_v11_fixture_stat_write
		after insert or update or delete on public.unit_tag_judgment_stat
		for each row execute function pg_temp.observe_vndb_v11_stat_write()`,
	);
	await client.query("truncate pg_temp.vndb_v11_stat_write_observation");
	await client.query(
		`update public.unit_tag_judgment
		set fit_vote = null, fit_updated_at = null, updated_at = $1
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, DirectTagId, ProfileIds[0]],
	);
	let statWrites = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_stat_write_observation",
	);
	assert(
		statWrites.count === "1",
		`A direct fit mutation must recompute its aggregate exactly once; received ${statWrites.count}`,
	);
	const sparse = await queryOne<{
		readonly fitVote: number | null;
		readonly spoilerLevel: number | null;
		readonly spoilerTimestampPreserved: boolean;
	}>(
		client,
		`select
			fit_vote as "fitVote",
			spoiler_level as "spoilerLevel",
			spoiler_updated_at = $1::timestamptz as "spoilerTimestampPreserved"
		from public.unit_tag_judgment
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, DirectTagId, ProfileIds[0]],
	);
	assert(
		sparse.fitVote === null && sparse.spoilerLevel === 2 && sparse.spoilerTimestampPreserved,
		"Clearing direct fit evidence must preserve independent spoiler evidence",
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Direct aggregate must remove only the cleared fit dimension",
	);
	await client.query("truncate pg_temp.vndb_v11_stat_write_observation");
	await client.query(
		`update public.unit_tag_judgment
		set spoiler_level = 0, spoiler_updated_at = $1, updated_at = $1
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, DirectTagId, ProfileIds[0]],
	);
	statWrites = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_stat_write_observation",
	);
	assert(
		statWrites.count === "1",
		`A spoiler-only mutation must recompute its aggregate exactly once; received ${statWrites.count}`,
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Direct spoiler mutation must preserve the independent fit aggregate",
	);
	await client.query("drop trigger vndb_v11_fixture_stat_write on public.unit_tag_judgment_stat");
	await client.query("drop table pg_temp.vndb_v11_stat_write_observation");
}

async function verifyPathJudgmentsAndConflicts(client: Client): Promise<void> {
	await client.query(
		`insert into public.unit_structure_application_judgment (
			unit_id, structure_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values
			($1, $2, $3, 1, 2, $5, $5, $5, $5),
			($1, $2, $4, null, 1, null, $5, $5, $5)`,
		[TargetUnitId, PathOneId, ProfileIds[0], ProfileIds[2], Timestamp],
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Path application judgment aggregate mismatch",
	);
	let support = await queryOne<{
		readonly count: string;
		readonly maximumProjectionVersion: number | null;
		readonly minimumProjectionVersion: number | null;
	}>(
		client,
		`select count(*)::text as count,
			min(projection_version)::integer as "minimumProjectionVersion",
			max(projection_version)::integer as "maximumProjectionVersion"
		from public.current_unit_tag_structure_support
		where unit_id = $1 and structure_id = $2 and profile_id = $3`,
		[TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assert(
		support.count === "3" &&
			support.minimumProjectionVersion === 1 &&
			support.maximumProjectionVersion === 1,
		"A positive Path judgment must project one support row per current-generation member",
	);

	await client.query(
		`update public.unit_structure_application_judgment
		set fit_vote = null, fit_updated_at = null, updated_at = $1
		where unit_id = $2 and structure_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 0, voteCount: 0, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Clearing Path fit must preserve Path spoiler evidence",
	);
	support = await queryOne<{
		readonly count: string;
		readonly maximumProjectionVersion: number | null;
		readonly minimumProjectionVersion: number | null;
	}>(
		client,
		`select count(*)::text as count,
			min(projection_version)::integer as "minimumProjectionVersion",
			max(projection_version)::integer as "maximumProjectionVersion"
		from public.current_unit_tag_structure_support
		where unit_id = $1 and structure_id = $2 and profile_id = $3`,
		[TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assert(support.count === "0", "Clearing Path fit must remove only derived support");

	await client.query(
		`update public.unit_structure_application_judgment
		set fit_vote = 1, fit_updated_at = $1, updated_at = $1
		where unit_id = $2 and structure_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Restoring Path fit must not duplicate spoiler evidence",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag_judgment (
					unit_id, tag_id, profile_id, fit_vote, fit_updated_at
				) values ($1, $2, $3, -1, $4)`,
				[TargetUnitId, TagAId, ProfileIds[0], Timestamp],
			),
		{ code: "23514" },
		"A negative direct judgment must conflict with positive Path support",
	);

	await client.query(
		`insert into public.unit_tag_judgment (
			unit_id, tag_id, profile_id, fit_vote, fit_updated_at
		) values ($1, $2, $3, -1, $4)`,
		[TargetUnitId, TagBId, ProfileIds[1], Timestamp],
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_structure_application_judgment (
					unit_id, structure_id, profile_id, fit_vote, fit_updated_at
				) values ($1, $2, $3, 1, $4)`,
				[TargetUnitId, PathOneId, ProfileIds[1], Timestamp],
			),
		{ code: "23514" },
		"Positive Path support must conflict with an existing negative direct judgment",
	);

	await client.query(
		`insert into public.unit_structure_application (
			unit_id, structure_id, created_by_profile_id
		) values ($1, $2, $3)`,
		[TagAId, PathOneId, ProfileIds[0]],
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_structure_application_judgment (
					unit_id, structure_id, profile_id, fit_vote, fit_updated_at
				) values ($1, $2, $3, 1, $4)`,
				[TagAId, PathOneId, ProfileIds[2], Timestamp],
			),
		{ code: "23514" },
		"A hierarchy Path must not apply to one of its own members",
	);
	const effective = await queryOne<{
		readonly direct: boolean;
		readonly structureSupportCount: string;
	}>(
		client,
		`select direct, structure_support_count::text as "structureSupportCount"
		from public.current_unit_effective_tag where unit_id = $1 and tag_id = $2`,
		[TargetUnitId, TagAId],
	);
	assert(
		effective.direct && effective.structureSupportCount === "1",
		"Effective Tag projection must preserve direct and Path-derived provenance separately",
	);
}

async function verifyRealmJudgments(client: Client): Promise<void> {
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.realm_tag_judgment (
					realm_id, unit_id, tag_id, profile_id, fit_vote, fit_updated_at
				) values ($1, $2, $3, $4, 1, $5)`,
				[RealmId, TargetUnitId, RealmTagId, ProfileIds[0], Timestamp],
			),
		{ code: "23514", constraint: "realm_tag_judgment_realm_tag_voting_enabled" },
		"Realm Tag judgments must require the Realm voting switch",
	);
	await client.query("update public.realm set realm_tag_voting_enabled = true where id = $1", [
		RealmId,
	]);
	await client.query(
		`insert into public.realm_tag_judgment (
			realm_id, unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values
			($1, $2, $3, $4, 1, 0, $7, $7, $7, $7),
			($1, $2, $3, $5, -1, null, $7, null, $7, $7),
			($1, $2, $3, $6, null, 2, null, $7, $7, $7)`,
		[RealmId, TargetUnitId, RealmTagId, ...ProfileIds, Timestamp],
	);
	assertAggregate(
		await readRealmAggregate(client),
		{ score: 0, voteCount: 2, spoilerCount: 2, none: 1, minor: 0, major: 1 },
		"Realm judgment aggregate mismatch",
	);
	await client.query(
		`update public.realm_tag_judgment
		set fit_vote = null, fit_updated_at = null, updated_at = $1
		where realm_id = $2 and unit_id = $3 and tag_id = $4 and profile_id = $5`,
		[Timestamp, RealmId, TargetUnitId, RealmTagId, ProfileIds[0]],
	);
	assertAggregate(
		await readRealmAggregate(client),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 0, major: 1 },
		"Clearing Realm fit must preserve Realm spoiler evidence",
	);
	await client.query(
		`update public.realm_tag_judgment
		set spoiler_level = 1, spoiler_updated_at = $1, updated_at = $1
		where realm_id = $2 and unit_id = $3 and tag_id = $4 and profile_id = $5`,
		[Timestamp, RealmId, TargetUnitId, RealmTagId, ProfileIds[0]],
	);
	assertAggregate(
		await readRealmAggregate(client),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Realm spoiler mutation must preserve independent Realm fit evidence",
	);
	const globalCount = await queryOne<{ readonly count: string }>(
		client,
		`select count(*)::text as count from public.current_unit_tag_judgment_stat
		where unit_id = $1 and tag_id = $2`,
		[TargetUnitId, RealmTagId],
	);
	assert(
		globalCount.count === "0",
		"Realm judgment evidence must never be merged into the global aggregate",
	);
}

async function verifySparseJudgmentConstraints(client: Client): Promise<void> {
	const families = [
		{
			relation: "unit_tag_judgment",
			predicate: "unit_id = $1 and tag_id = $2 and profile_id = $3",
			values: [TargetUnitId, DirectTagId, ProfileIds[1]],
			spoilerValues: [TargetUnitId, DirectTagId, ProfileIds[0]],
			constraintPrefix: "unit_tag_judgment",
		},
		{
			relation: "unit_structure_application_judgment",
			predicate: "unit_id = $1 and structure_id = $2 and profile_id = $3",
			values: [TargetUnitId, PathOneId, ProfileIds[0]],
			spoilerValues: [TargetUnitId, PathOneId, ProfileIds[0]],
			constraintPrefix: "unit_structure_application_judgment",
		},
		{
			relation: "realm_tag_judgment",
			predicate: "realm_id = $1 and unit_id = $2 and tag_id = $3 and profile_id = $4",
			values: [RealmId, TargetUnitId, RealmTagId, ProfileIds[1]],
			spoilerValues: [RealmId, TargetUnitId, RealmTagId, ProfileIds[0]],
			constraintPrefix: "realm_tag_judgment",
		},
	] as const;
	for (const family of families) {
		await expectDatabaseError(
			client,
			() =>
				client.query(
					`update public.${family.relation}
					set fit_vote = null, spoiler_level = null,
						fit_updated_at = null, spoiler_updated_at = null
					where ${family.predicate}`,
					[...family.values],
				),
			{
				code: "23514",
				constraint: `${family.constraintPrefix}_sparse_check`,
			},
			`${family.relation} must reject a row with neither judgment dimension`,
		);
		await expectDatabaseError(
			client,
			() =>
				client.query(
					`update public.${family.relation}
					set fit_updated_at = null where ${family.predicate}`,
					[...family.values],
				),
			{
				code: "23514",
				constraint: `${family.constraintPrefix}_fit_timestamp_check`,
			},
			`${family.relation} must pair fit evidence with its independent timestamp`,
		);
		await expectDatabaseError(
			client,
			() =>
				client.query(
					`update public.${family.relation}
					set spoiler_updated_at = null where ${family.predicate}`,
					[...family.spoilerValues],
				),
			{
				code: "23514",
				constraint: `${family.constraintPrefix}_spoiler_timestamp_check`,
			},
			`${family.relation} must pair spoiler evidence with its independent timestamp`,
		);
	}
}

const RealmAggregateBaseline = {
	score: -1,
	voteCount: 1,
	spoilerCount: 2,
	none: 0,
	minor: 1,
	major: 1,
} as const;

async function readRealmAggregateFingerprint(client: Client): Promise<{
	readonly ctid: string;
	readonly updatedAt: string;
	readonly xmin: string;
}> {
	return queryOne(
		client,
		`select ctid::text as ctid, updated_at::text as "updatedAt", xmin::text as xmin
		from public.realm_tag_judgment_stat
		where realm_id = $1 and unit_id = $2 and tag_id = $3`,
		[RealmId, TargetUnitId, RealmTagId],
	);
}

async function readRealmSourceCounts(client: Client): Promise<{
	readonly judgments: string;
	readonly stats: string;
}> {
	return queryOne(
		client,
		`select
			(select count(*) from public.realm_tag_judgment
			 where realm_id = $1 and unit_id = $2 and tag_id = $3)::text as judgments,
			(select count(*) from public.realm_tag_judgment_stat
			 where realm_id = $1 and unit_id = $2 and tag_id = $3)::text as stats`,
		[RealmId, TargetUnitId, RealmTagId],
	);
}

async function assertRealmBaselineRestored(client: Client, message: string): Promise<void> {
	const counts = await readRealmSourceCounts(client);
	assert(
		counts.judgments === "3" && counts.stats === "1",
		`${message}; source/stat rows were not restored: ${JSON.stringify(counts)}`,
	);
	assertAggregate(await readRealmAggregate(client), RealmAggregateBaseline, message);
}

async function verifyRealmNoOpStatMaintenance(client: Client): Promise<void> {
	await client.query(
		"create temporary table vndb_v11_realm_stat_write_observation (operation text not null) on commit drop",
	);
	await client.query(`create function pg_temp.observe_vndb_v11_realm_stat_write() returns trigger
		language plpgsql as $$
		begin
			insert into pg_temp.vndb_v11_realm_stat_write_observation (operation) values (TG_OP);
			return null;
		end;
		$$`);
	await client.query(
		`create trigger vndb_v11_fixture_realm_stat_write
		after insert or update or delete on public.realm_tag_judgment_stat
		for each row execute function pg_temp.observe_vndb_v11_realm_stat_write()`,
	);

	const originalFingerprint = await readRealmAggregateFingerprint(client);
	await client.query(
		`insert into public.realm_tag_judgment (
			realm_id, unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values ($1, $2, $3, $4, null, 2, null, $5, $5, $5)
		on conflict (realm_id, unit_id, tag_id, profile_id) do update set
			fit_vote = excluded.fit_vote,
			spoiler_level = excluded.spoiler_level,
			fit_updated_at = excluded.fit_updated_at,
			spoiler_updated_at = excluded.spoiler_updated_at,
			updated_at = excluded.updated_at`,
		[RealmId, TargetUnitId, RealmTagId, ProfileIds[2], Timestamp],
	);
	let writes = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_realm_stat_write_observation",
	);
	let fingerprint = await readRealmAggregateFingerprint(client);
	assert(
		writes.count === "0" && JSON.stringify(fingerprint) === JSON.stringify(originalFingerprint),
		`An identical Realm upsert must not rewrite its aggregate; writes=${writes.count}, before=${JSON.stringify(originalFingerprint)}, after=${JSON.stringify(fingerprint)}`,
	);

	await client.query("truncate pg_temp.vndb_v11_realm_stat_write_observation");
	await client.query(
		`insert into public.realm_tag_judgment (
			realm_id, unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values ($1, $2, $3, $4, null, 2, null, $5, $6, $5)
		on conflict (realm_id, unit_id, tag_id, profile_id) do update set
			fit_vote = excluded.fit_vote,
			spoiler_level = excluded.spoiler_level,
			fit_updated_at = excluded.fit_updated_at,
			spoiler_updated_at = excluded.spoiler_updated_at,
			updated_at = excluded.updated_at`,
		[RealmId, TargetUnitId, RealmTagId, ProfileIds[2], "2026-08-23T14:00:01.000Z", Timestamp],
	);
	writes = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_realm_stat_write_observation",
	);
	fingerprint = await readRealmAggregateFingerprint(client);
	assert(
		writes.count === "0" && JSON.stringify(fingerprint) === JSON.stringify(originalFingerprint),
		`A timestamp-only Realm upsert must not rewrite its aggregate; writes=${writes.count}, before=${JSON.stringify(originalFingerprint)}, after=${JSON.stringify(fingerprint)}`,
	);

	await client.query("truncate pg_temp.vndb_v11_realm_stat_write_observation");
	await client.query(
		`update public.realm_tag_judgment
		set
			fit_vote = 1,
			spoiler_level = 0,
			fit_updated_at = $1,
			spoiler_updated_at = $1,
			updated_at = $1
		where realm_id = $2 and unit_id = $3 and tag_id = $4 and profile_id = $5`,
		["2026-08-23T14:00:02.000Z", RealmId, TargetUnitId, RealmTagId, ProfileIds[1]],
	);
	writes = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_realm_stat_write_observation",
	);
	assert(
		writes.count === "1",
		`A combined Realm fit/spoiler change must write its stat once; got ${writes.count}`,
	);
	assertAggregate(
		await readRealmAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 3, none: 1, minor: 1, major: 1 },
		"A combined Realm fit/spoiler change must apply one exact semantic delta",
	);

	await client.query("truncate pg_temp.vndb_v11_realm_stat_write_observation");
	await client.query(
		`update public.realm_tag_judgment
		set
			fit_vote = -1,
			spoiler_level = null,
			fit_updated_at = $1,
			spoiler_updated_at = null,
			updated_at = $1
		where realm_id = $2 and unit_id = $3 and tag_id = $4 and profile_id = $5`,
		["2026-08-23T14:00:03.000Z", RealmId, TargetUnitId, RealmTagId, ProfileIds[1]],
	);
	writes = await queryOne<{ readonly count: string }>(
		client,
		"select count(*)::text as count from pg_temp.vndb_v11_realm_stat_write_observation",
	);
	assert(
		writes.count === "1",
		`Restoring a Realm fit/spoiler pair must write its stat once; got ${writes.count}`,
	);
	assertAggregate(
		await readRealmAggregate(client),
		RealmAggregateBaseline,
		"Realm aggregate did not return to its baseline",
	);
	await client.query(
		"drop trigger vndb_v11_fixture_realm_stat_write on public.realm_tag_judgment_stat",
	);
	await client.query("drop table pg_temp.vndb_v11_realm_stat_write_observation");
}

async function verifyRealmCascadeCase(
	client: Client,
	message: string,
	operation: () => Promise<unknown>,
	expected: {
		readonly aggregate?: Parameters<typeof assertAggregate>[1];
		readonly judgments: number;
		readonly stats: number;
	},
): Promise<void> {
	const savepoint = `vndb_v11_realm_cascade_${++savepointSequence}`;
	await client.query(`savepoint ${savepoint}`);
	try {
		await operation();
		const counts = await readRealmSourceCounts(client);
		assert(
			counts.judgments === String(expected.judgments) && counts.stats === String(expected.stats),
			`${message}; unexpected surviving rows: ${JSON.stringify(counts)}`,
		);
		if (expected.aggregate)
			assertAggregate(await readRealmAggregate(client), expected.aggregate, message);
	} finally {
		await client.query(`rollback to savepoint ${savepoint}`);
		await client.query(`release savepoint ${savepoint}`);
	}
	await assertRealmBaselineRestored(client, `${message} rollback must restore the fixture`);
}

async function verifyRealmMissingStatCorruption(
	client: Client,
	message: string,
	operation: () => Promise<unknown>,
): Promise<void> {
	const savepoint = `vndb_v11_realm_corruption_${++savepointSequence}`;
	await client.query(`savepoint ${savepoint}`);
	try {
		const deletion = await client.query(
			`delete from public.realm_tag_judgment_stat
			where realm_id = $1 and unit_id = $2 and tag_id = $3`,
			[RealmId, TargetUnitId, RealmTagId],
		);
		assert(deletion.rowCount === 1, `${message}; failed to inject one missing-stat row`);
		await expectDatabaseError(
			client,
			operation,
			{ code: "23514", constraint: "realm_tag_judgment_stat_missing" },
			message,
		);
	} finally {
		await client.query(`rollback to savepoint ${savepoint}`);
		await client.query(`release savepoint ${savepoint}`);
	}
	await assertRealmBaselineRestored(client, `${message} rollback must restore the fixture`);
}

async function verifyRealmCascadeAndCorruptionGuards(client: Client): Promise<void> {
	await verifyRealmCascadeCase(
		client,
		"Deleting a judgment's parent Unit must cascade its Realm source and stat",
		() => client.query("delete from public.unit where id = $1", [TargetUnitId]),
		{ judgments: 0, stats: 0 },
	);
	await verifyRealmCascadeCase(
		client,
		"Deleting a Realm subtype must cascade its Realm source and stat",
		() => client.query("delete from public.realm where id = $1", [RealmId]),
		{ judgments: 0, stats: 0 },
	);
	await verifyRealmCascadeCase(
		client,
		"Deleting a Realm Tag context must cascade its Realm source and stat",
		() =>
			client.query("delete from public.realm_tag_context where realm_id = $1 and tag_id = $2", [
				RealmId,
				RealmTagId,
			]),
		{ judgments: 0, stats: 0 },
	);
	await verifyRealmCascadeCase(
		client,
		"Deleting a Tag subtype must cascade its Realm source and stat",
		() => client.query("delete from public.tag where id = $1", [RealmTagId]),
		{ judgments: 0, stats: 0 },
	);
	await verifyRealmCascadeCase(
		client,
		"Deleting one Profile must decrement the Realm aggregate consistently",
		() => client.query("delete from public.profile where id = $1", [ProfileIds[1]]),
		{
			judgments: 2,
			stats: 1,
			aggregate: { score: 0, voteCount: 0, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		},
	);

	await verifyRealmMissingStatCorruption(
		client,
		"An ordinary Realm judgment DELETE must reject a missing live-parent stat",
		() =>
			client.query(
				`delete from public.realm_tag_judgment
				where realm_id = $1 and unit_id = $2 and tag_id = $3 and profile_id = $4`,
				[RealmId, TargetUnitId, RealmTagId, ProfileIds[1]],
			),
	);
	await verifyRealmMissingStatCorruption(
		client,
		"An ordinary Realm judgment UPDATE must reject a missing live-parent stat",
		() =>
			client.query(
				`update public.realm_tag_judgment
				set fit_vote = 1, fit_updated_at = $1, updated_at = $1
				where realm_id = $2 and unit_id = $3 and tag_id = $4 and profile_id = $5`,
				[Timestamp, RealmId, TargetUnitId, RealmTagId, ProfileIds[1]],
			),
	);
}

async function verifySubjectJudgments(client: Client): Promise<void> {
	await client.query(
		`insert into public.subject_association_judgment (
			association_id, profile_id, spoiler_level, created_at, updated_at
		) values ($1, $2, 2, $4, $4), ($1, $3, 0, $4, $4)`,
		[SubjectAssociationId, ProfileIds[0], ProfileIds[1], Timestamp],
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 1, minor: 0, major: 1 },
		"Subject-association spoiler aggregate mismatch",
	);
	await client.query(
		`update public.subject_association_judgment
		set spoiler_level = 1, updated_at = $1
		where association_id = $2 and profile_id = $3`,
		[Timestamp, SubjectAssociationId, ProfileIds[0]],
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 1, minor: 1, major: 0 },
		"Subject-association spoiler update must preserve the full distribution",
	);
	await client.query(
		`delete from public.subject_association_judgment
		where association_id = $1 and profile_id = $2`,
		[SubjectAssociationId, ProfileIds[1]],
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 0, minor: 1, major: 0 },
		"Subject-association spoiler deletion must decrement only its evidence",
	);
}

async function readDirectNoOpFingerprint(client: Client): Promise<string> {
	const row = await queryOne<{ readonly fingerprint: string }>(
		client,
		`select jsonb_build_object(
			'statScore', stat.score,
			'statVoteCount', stat.vote_count,
			'statSpoilerCount', stat.spoiler_vote_count,
			'statNone', stat.spoiler_none_count,
			'statMinor', stat.spoiler_minor_count,
			'statMajor', stat.spoiler_major_count,
			'statUpdatedAt', stat.updated_at::text,
			'statXmin', stat.xmin::text,
			'statCtid', stat.ctid::text,
			'effectiveValue', vote.value,
			'effectiveUpdatedAt', vote.updated_at::text,
			'effectiveXmin', vote.xmin::text,
			'effectiveCtid', vote.ctid::text
		)::text as fingerprint
		from public.unit_tag_judgment_stat as stat
		join public.unit_effective_tag_vote as vote
			on vote.unit_id = stat.unit_id and vote.tag_id = stat.tag_id
		where stat.unit_id = $1 and stat.tag_id = $2 and vote.profile_id = $3`,
		[TargetUnitId, DirectTagId, ProfileIds[1]],
	);
	return row.fingerprint;
}

async function readPathNoOpFingerprint(client: Client): Promise<string> {
	const row = await queryOne<{ readonly fingerprint: string }>(
		client,
		`select jsonb_build_object(
			'score', stat.score,
			'voteCount', stat.vote_count,
			'spoilerCount', stat.spoiler_vote_count,
			'none', stat.spoiler_none_count,
			'minor', stat.spoiler_minor_count,
			'major', stat.spoiler_major_count,
			'updatedAt', stat.updated_at::text,
			'xmin', stat.xmin::text,
			'ctid', stat.ctid::text,
			'support', (
				select jsonb_agg(jsonb_build_object(
					'tagId', support.tag_id,
					'xmin', support.xmin::text,
					'ctid', support.ctid::text
				) order by support.tag_id)
				from public.unit_tag_structure_support as support
				where support.unit_id = stat.unit_id
					and support.structure_id = stat.structure_id
					and support.profile_id = $3
			)
		)::text as fingerprint
		from public.unit_structure_application_judgment_stat as stat
		where stat.unit_id = $1 and stat.structure_id = $2`,
		[TargetUnitId, PathOneId, ProfileIds[0]],
	);
	return row.fingerprint;
}

async function readSubjectNoOpFingerprint(client: Client): Promise<string> {
	const row = await queryOne<{ readonly fingerprint: string }>(
		client,
		`select jsonb_build_object(
			'spoilerCount', spoiler_vote_count,
			'none', spoiler_none_count,
			'minor', spoiler_minor_count,
			'major', spoiler_major_count,
			'updatedAt', updated_at::text,
			'xmin', xmin::text,
			'ctid', ctid::text
		)::text as fingerprint
		from public.subject_association_judgment_stat
		where association_id = $1`,
		[SubjectAssociationId],
	);
	return row.fingerprint;
}

async function expectNoAggregateProjectionWrite(
	client: Client,
	message: string,
	readFingerprint: () => Promise<string>,
	operation: () => Promise<{ readonly rowCount: number | null }>,
): Promise<void> {
	const before = await readFingerprint();
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	const result = await operation();
	assert(result.rowCount === 1, `${message}; source upsert did not affect exactly one row`);
	const after = await readFingerprint();
	const audit = await queryOne<{ readonly count: string; readonly details: string }>(
		client,
		`select
			count(*)::text as count,
			coalesce(string_agg(
				relation_name || ':' || operation,
				',' order by relation_name, operation
			), '') as details
		from pg_temp.vndb_v11_nonrealm_noop_write_observation`,
	);
	assert(
		audit.count === "0" && before === after,
		`${message}; observed ${audit.count} writes (${audit.details}), before=${before}, after=${after}`,
	);
}

async function assertAggregateProjectionWrites(
	client: Client,
	expected: string,
	message: string,
): Promise<void> {
	const audit = await queryOne<{ readonly details: string }>(
		client,
		`select coalesce(string_agg(
			relation_name || ':' || operation || '=' || writes,
			',' order by relation_name, operation
		), '') as details
		from (
			select relation_name, operation, count(*)::text as writes
			from pg_temp.vndb_v11_nonrealm_noop_write_observation
			group by relation_name, operation
		) as grouped_writes`,
	);
	assert(
		audit.details === expected,
		`${message}; expected ${expected}, observed ${audit.details || "no writes"}`,
	);
}

async function verifyNonRealmNoOpStatMaintenance(client: Client): Promise<void> {
	await client.query(
		`create temporary table vndb_v11_nonrealm_noop_write_observation (
			relation_name text not null,
			operation text not null
		) on commit drop`,
	);
	await client.query(`create function pg_temp.observe_vndb_v11_nonrealm_noop_write()
		returns trigger language plpgsql as $$
		begin
			insert into pg_temp.vndb_v11_nonrealm_noop_write_observation (
				relation_name, operation
			) values (TG_TABLE_NAME, TG_OP);
			return null;
		end;
		$$`);
	const observedRelations = [
		["unit_effective_tag_vote", "vndb_v11_fixture_effective_vote_noop_write"],
		["unit_tag_judgment_stat", "vndb_v11_fixture_unit_tag_stat_noop_write"],
		["unit_structure_application_judgment_stat", "vndb_v11_fixture_structure_stat_noop_write"],
		["unit_tag_structure_support", "vndb_v11_fixture_structure_support_noop_write"],
		["subject_association_judgment_stat", "vndb_v11_fixture_subject_stat_noop_write"],
	] as const;
	for (const [relationName, triggerName] of observedRelations)
		await client.query(
			`create trigger ${triggerName}
			after insert or update or delete on public.${relationName}
			for each row execute function pg_temp.observe_vndb_v11_nonrealm_noop_write()`,
		);

	const upsertDirect = (evidenceTimestamp: string) =>
		client.query(
			`insert into public.unit_tag_judgment (
				unit_id, tag_id, profile_id, fit_vote, spoiler_level,
				fit_updated_at, spoiler_updated_at, created_at, updated_at
			) values ($1, $2, $3, -1, null, $4, null, $5, $4)
			on conflict (unit_id, tag_id, profile_id) do update set
				fit_vote = excluded.fit_vote,
				spoiler_level = excluded.spoiler_level,
				fit_updated_at = excluded.fit_updated_at,
				spoiler_updated_at = excluded.spoiler_updated_at,
				updated_at = excluded.updated_at`,
			[TargetUnitId, DirectTagId, ProfileIds[1], evidenceTimestamp, Timestamp],
		);
	await expectNoAggregateProjectionWrite(
		client,
		"An identical direct upsert must not rewrite effective votes or stats",
		() => readDirectNoOpFingerprint(client),
		() => upsertDirect(Timestamp),
	);
	await expectNoAggregateProjectionWrite(
		client,
		"A timestamp-only direct upsert must not rewrite effective votes or stats",
		() => readDirectNoOpFingerprint(client),
		() => upsertDirect("2026-08-23T14:00:10.000Z"),
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	let mutation = await client.query(
		`update public.unit_tag_judgment
		set
			fit_vote = 1,
			spoiler_level = 2,
			fit_updated_at = $1,
			spoiler_updated_at = $1,
			updated_at = $1
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		["2026-08-23T14:00:13.000Z", TargetUnitId, DirectTagId, ProfileIds[1]],
	);
	assert(mutation.rowCount === 1, "Direct semantic-delta fixture did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		"unit_effective_tag_vote:UPDATE=1,unit_tag_judgment_stat:UPDATE=1",
		"One combined direct fit/spoiler change must write each derived row exactly once",
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: 1, voteCount: 1, spoilerCount: 3, none: 1, minor: 1, major: 1 },
		"Combined direct fit/spoiler delta has the wrong aggregate",
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	mutation = await client.query(
		`update public.unit_tag_judgment
		set
			fit_vote = -1,
			spoiler_level = null,
			fit_updated_at = $1,
			spoiler_updated_at = null,
			updated_at = $1
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		["2026-08-23T14:00:14.000Z", TargetUnitId, DirectTagId, ProfileIds[1]],
	);
	assert(mutation.rowCount === 1, "Direct semantic-delta restore did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		"unit_effective_tag_vote:UPDATE=1,unit_tag_judgment_stat:UPDATE=1",
		"Restoring a combined direct fit/spoiler change must write each row once",
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Direct no-op upserts changed the aggregate",
	);

	const upsertPath = (evidenceTimestamp: string) =>
		client.query(
			`insert into public.unit_structure_application_judgment (
				unit_id, structure_id, profile_id, fit_vote, spoiler_level,
				fit_updated_at, spoiler_updated_at, created_at, updated_at
			) values ($1, $2, $3, 1, 2, $4, $4, $5, $4)
			on conflict (unit_id, structure_id, profile_id) do update set
				fit_vote = excluded.fit_vote,
				spoiler_level = excluded.spoiler_level,
				fit_updated_at = excluded.fit_updated_at,
				spoiler_updated_at = excluded.spoiler_updated_at,
				updated_at = excluded.updated_at`,
			[TargetUnitId, PathOneId, ProfileIds[0], evidenceTimestamp, Timestamp],
		);
	await expectNoAggregateProjectionWrite(
		client,
		"An identical Path judgment upsert must not rewrite support or stats",
		() => readPathNoOpFingerprint(client),
		() => upsertPath(Timestamp),
	);
	await expectNoAggregateProjectionWrite(
		client,
		"A timestamp-only Path judgment upsert must not rewrite support or stats",
		() => readPathNoOpFingerprint(client),
		() => upsertPath("2026-08-23T14:00:11.000Z"),
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	mutation = await client.query(
		`update public.unit_structure_application_judgment
		set
			fit_vote = -1,
			spoiler_level = 0,
			fit_updated_at = $1,
			spoiler_updated_at = $1,
			updated_at = $1
		where unit_id = $2 and structure_id = $3 and profile_id = $4`,
		["2026-08-23T14:00:15.000Z", TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assert(mutation.rowCount === 1, "Path semantic-delta fixture did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		[
			"unit_effective_tag_vote:DELETE=3",
			"unit_structure_application_judgment_stat:UPDATE=1",
			"unit_tag_judgment_stat:DELETE=2",
			"unit_tag_judgment_stat:UPDATE=1",
			"unit_tag_structure_support:DELETE=3",
		].join(","),
		"One combined Path fit/spoiler change must write each aggregate and support row once",
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Combined Path fit/spoiler delta has the wrong aggregate",
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	mutation = await client.query(
		`update public.unit_structure_application_judgment
		set
			fit_vote = 1,
			spoiler_level = 2,
			fit_updated_at = $1,
			spoiler_updated_at = $1,
			updated_at = $1
		where unit_id = $2 and structure_id = $3 and profile_id = $4`,
		["2026-08-23T14:00:16.000Z", TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assert(mutation.rowCount === 1, "Path semantic-delta restore did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		[
			"unit_effective_tag_vote:INSERT=3",
			"unit_structure_application_judgment_stat:UPDATE=1",
			"unit_tag_judgment_stat:INSERT=2",
			"unit_tag_judgment_stat:UPDATE=1",
			"unit_tag_structure_support:INSERT=3",
		].join(","),
		"Restoring a combined Path fit/spoiler change must write each derived row once",
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Path no-op upserts changed the aggregate",
	);

	const upsertSubject = (evidenceTimestamp: string) =>
		client.query(
			`insert into public.subject_association_judgment (
				association_id, profile_id, spoiler_level, created_at, updated_at
			) values ($1, $2, 1, $3, $4)
			on conflict (association_id, profile_id) do update set
				spoiler_level = excluded.spoiler_level,
				updated_at = excluded.updated_at`,
			[SubjectAssociationId, ProfileIds[0], Timestamp, evidenceTimestamp],
		);
	await expectNoAggregateProjectionWrite(
		client,
		"An identical subject-association upsert must not rewrite its stat",
		() => readSubjectNoOpFingerprint(client),
		() => upsertSubject(Timestamp),
	);
	await expectNoAggregateProjectionWrite(
		client,
		"A timestamp-only subject-association upsert must not rewrite its stat",
		() => readSubjectNoOpFingerprint(client),
		() => upsertSubject("2026-08-23T14:00:12.000Z"),
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	mutation = await client.query(
		`update public.subject_association_judgment
		set spoiler_level = 2, updated_at = $1
		where association_id = $2 and profile_id = $3`,
		["2026-08-23T14:00:17.000Z", SubjectAssociationId, ProfileIds[0]],
	);
	assert(mutation.rowCount === 1, "Subject semantic-delta fixture did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		"subject_association_judgment_stat:UPDATE=1",
		"One subject spoiler change must write its aggregate exactly once",
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 0, minor: 0, major: 1 },
		"Subject spoiler delta has the wrong distribution",
	);
	await client.query("truncate pg_temp.vndb_v11_nonrealm_noop_write_observation");
	mutation = await client.query(
		`update public.subject_association_judgment
		set spoiler_level = 1, updated_at = $1
		where association_id = $2 and profile_id = $3`,
		["2026-08-23T14:00:18.000Z", SubjectAssociationId, ProfileIds[0]],
	);
	assert(mutation.rowCount === 1, "Subject semantic-delta restore did not update one source row");
	await assertAggregateProjectionWrites(
		client,
		"subject_association_judgment_stat:UPDATE=1",
		"Restoring a subject spoiler must write its aggregate exactly once",
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 0, minor: 1, major: 0 },
		"Subject-association no-op upserts changed the aggregate",
	);

	for (const [relationName, triggerName] of observedRelations)
		await client.query(`drop trigger ${triggerName} on public.${relationName}`);
	await client.query("drop table pg_temp.vndb_v11_nonrealm_noop_write_observation");
}

async function verifyMissingDerivedRowCorruption(
	client: Client,
	message: string,
	deleteProjection: () => Promise<{ readonly rowCount: number | null }>,
	mutateSource: () => Promise<unknown>,
	expectedConstraint: string,
): Promise<void> {
	const savepoint = `vndb_v11_derived_corruption_${++savepointSequence}`;
	await client.query(`savepoint ${savepoint}`);
	try {
		const deletion = await deleteProjection();
		assert(deletion.rowCount === 1, `${message}; failed to inject exactly one missing row`);
		await expectDatabaseError(
			client,
			mutateSource,
			{ code: "23514", constraint: expectedConstraint },
			message,
		);
	} finally {
		await client.query(`rollback to savepoint ${savepoint}`);
		await client.query(`release savepoint ${savepoint}`);
	}
}

async function verifyNonRealmCorruptionGuards(client: Client): Promise<void> {
	await verifyMissingDerivedRowCorruption(
		client,
		"A direct judgment mutation must reject a missing live-parent stat",
		() =>
			client.query(
				`delete from public.unit_tag_judgment_stat
				where unit_id = $1 and tag_id = $2`,
				[TargetUnitId, DirectTagId],
			),
		() =>
			client.query(
				`update public.unit_tag_judgment
				set fit_vote = 1, fit_updated_at = $1, updated_at = $1
				where unit_id = $2 and tag_id = $3 and profile_id = $4`,
				["2026-08-23T14:00:19.000Z", TargetUnitId, DirectTagId, ProfileIds[1]],
			),
		"unit_tag_judgment_stat_missing",
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Direct missing-stat injection rollback changed the aggregate",
	);

	await verifyMissingDerivedRowCorruption(
		client,
		"A Path judgment mutation must reject a missing live-parent stat",
		() =>
			client.query(
				`delete from public.unit_structure_application_judgment_stat
				where unit_id = $1 and structure_id = $2`,
				[TargetUnitId, PathOneId],
			),
		() =>
			client.query(
				`update public.unit_structure_application_judgment
				set spoiler_level = 0, spoiler_updated_at = $1, updated_at = $1
				where unit_id = $2 and structure_id = $3 and profile_id = $4`,
				["2026-08-23T14:00:20.000Z", TargetUnitId, PathOneId, ProfileIds[0]],
			),
		"unit_structure_application_judgment_stat_missing",
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Path missing-stat injection rollback changed the aggregate",
	);

	await verifyMissingDerivedRowCorruption(
		client,
		"A subject-association judgment mutation must reject a missing live-parent stat",
		() =>
			client.query(
				`delete from public.subject_association_judgment_stat where association_id = $1`,
				[SubjectAssociationId],
			),
		() =>
			client.query(
				`update public.subject_association_judgment
				set spoiler_level = 2, updated_at = $1
				where association_id = $2 and profile_id = $3`,
				["2026-08-23T14:00:21.000Z", SubjectAssociationId, ProfileIds[0]],
			),
		"subject_association_judgment_stat_missing",
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 0, minor: 1, major: 0 },
		"Subject missing-stat injection rollback changed the aggregate",
	);

	await verifyMissingDerivedRowCorruption(
		client,
		"A direct judgment mutation must reject a missing live-source effective Tag projection",
		() =>
			client.query(
				`delete from public.unit_effective_tag
				where unit_id = $1 and tag_id = $2`,
				[TargetUnitId, DirectTagId],
			),
		() =>
			client.query(
				`update public.unit_tag_judgment
				set fit_vote = 1, fit_updated_at = $1, updated_at = $1
				where unit_id = $2 and tag_id = $3 and profile_id = $4`,
				["2026-08-23T14:00:22.000Z", TargetUnitId, DirectTagId, ProfileIds[1]],
			),
		"unit_effective_tag_missing",
	);
	const directProjection = await queryOne<{
		readonly direct: boolean;
		readonly rows: string;
		readonly structureSupportCount: string;
	}>(
		client,
		`select
			count(*)::text as rows,
			bool_and(direct) as direct,
			max(structure_support_count)::text as "structureSupportCount"
		from public.current_unit_effective_tag
		where unit_id = $1 and tag_id = $2`,
		[TargetUnitId, DirectTagId],
	);
	assert(
		directProjection.rows === "1" &&
			directProjection.direct &&
			directProjection.structureSupportCount === "0",
		"Effective-Tag corruption injection rollback changed the direct projection",
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Effective-Tag corruption injection rollback changed the direct aggregate",
	);
}

async function verifyRollbackIsolatedCase(
	client: Client,
	name: string,
	operation: () => Promise<unknown>,
	verify: () => Promise<void>,
): Promise<void> {
	const savepoint = `vndb_v11_${name}_${++savepointSequence}`;
	await client.query(`savepoint ${savepoint}`);
	try {
		await operation();
		await verify();
	} finally {
		await client.query(`rollback to savepoint ${savepoint}`);
		await client.query(`release savepoint ${savepoint}`);
	}
}

async function verifyNonRealmParentCascades(client: Client): Promise<void> {
	await verifyRollbackIsolatedCase(
		client,
		"direct_parent_cascade",
		() =>
			client.query("delete from public.unit_tag where unit_id = $1 and tag_id = $2", [
				TargetUnitId,
				DirectTagId,
			]),
		async () => {
			const rows = await queryOne<{
				readonly effective: string;
				readonly effectiveVotes: string;
				readonly judgments: string;
				readonly stats: string;
			}>(
				client,
				`select
					(select count(*) from public.unit_tag_judgment
					 where unit_id = $1 and tag_id = $2)::text as judgments,
					(select count(*) from public.unit_effective_tag
					 where unit_id = $1 and tag_id = $2)::text as effective,
					(select count(*) from public.unit_effective_tag_vote
					 where unit_id = $1 and tag_id = $2)::text as "effectiveVotes",
					(select count(*) from public.unit_tag_judgment_stat
					 where unit_id = $1 and tag_id = $2)::text as stats`,
				[TargetUnitId, DirectTagId],
			);
			assert(
				Object.values(rows).every((count) => count === "0"),
				`Deleting a direct Tag context must cascade all judgment projections; received ${JSON.stringify(rows)}`,
			);
		},
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Direct parent-cascade rollback did not restore exact aggregate parity",
	);

	await verifyRollbackIsolatedCase(
		client,
		"path_parent_cascade",
		() =>
			client.query(
				`delete from public.unit_structure_application
				where unit_id = $1 and structure_id = $2`,
				[TargetUnitId, PathOneId],
			),
		async () => {
			const rows = await queryOne<{
				readonly application: string;
				readonly judgments: string;
				readonly stats: string;
				readonly supports: string;
			}>(
				client,
				`select
					(select count(*) from public.unit_structure_application
					 where unit_id = $1 and structure_id = $2)::text as application,
					(select count(*) from public.unit_structure_application_judgment
					 where unit_id = $1 and structure_id = $2)::text as judgments,
					(select count(*) from public.unit_structure_application_judgment_stat
					 where unit_id = $1 and structure_id = $2)::text as stats,
					(select count(*) from public.unit_tag_structure_support
					 where unit_id = $1 and structure_id = $2)::text as supports`,
				[TargetUnitId, PathOneId],
			);
			assert(
				Object.values(rows).every((count) => count === "0"),
				`Deleting a Path application must cascade every source/projection row; received ${JSON.stringify(rows)}`,
			);
		},
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Path parent-cascade rollback did not restore exact aggregate parity",
	);

	await verifyRollbackIsolatedCase(
		client,
		"subject_parent_cascade",
		() =>
			client.query("delete from public.subject_association where id = $1", [SubjectAssociationId]),
		async () => {
			const rows = await queryOne<{ readonly judgments: string; readonly stats: string }>(
				client,
				`select
					(select count(*) from public.subject_association_judgment
					 where association_id = $1)::text as judgments,
					(select count(*) from public.subject_association_judgment_stat
					 where association_id = $1)::text as stats`,
				[SubjectAssociationId],
			);
			assert(
				rows.judgments === "0" && rows.stats === "0",
				`Deleting a subject association must cascade its judgments and stat; received ${JSON.stringify(rows)}`,
			);
		},
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 0, minor: 1, major: 0 },
		"Subject parent-cascade rollback did not restore exact aggregate parity",
	);
}

async function verifyAggregateCheckConstraints(client: Client): Promise<void> {
	const cases = [
		{
			relation: "unit_tag_judgment_stat",
			predicate: "unit_id = $1 and tag_id = $2",
			values: [TargetUnitId, DirectTagId],
			constraint: "unit_tag_judgment_stat_spoiler_nonnegative_check",
		},
		{
			relation: "unit_structure_application_judgment_stat",
			predicate: "unit_id = $1 and structure_id = $2",
			values: [TargetUnitId, PathOneId],
			constraint: "unit_structure_application_judgment_stat_spoiler_nonnegative_check",
		},
		{
			relation: "realm_tag_judgment_stat",
			predicate: "realm_id = $1 and unit_id = $2 and tag_id = $3",
			values: [RealmId, TargetUnitId, RealmTagId],
			constraint: "realm_tag_judgment_stat_spoiler_nonnegative_check",
		},
		{
			relation: "subject_association_judgment_stat",
			predicate: "association_id = $1",
			values: [SubjectAssociationId],
			constraint: "subject_association_judgment_stat_spoiler_nonnegative_check",
		},
	] as const;
	for (const fixture of cases)
		await expectDatabaseError(
			client,
			() =>
				client.query(
					`update public.${fixture.relation}
					set spoiler_vote_count = -1, spoiler_none_count = -1,
						spoiler_minor_count = 0, spoiler_major_count = 0
					where ${fixture.predicate}`,
					[...fixture.values],
				),
			{ code: "23514", constraint: fixture.constraint },
			`${fixture.relation} must reject a negative spoiler distribution`,
		);
}

type ContentLabelDecisionAction =
	| "content_label.apply"
	| "content_label.remove"
	| "content_label.replace";

async function createContentLabelDecision(
	client: Client,
	id: string,
	action: ContentLabelDecisionAction,
): Promise<void> {
	await client.query("set constraints all deferred");
	await client.query(
		`insert into public.governance_decision (
			id, action, basis_kind, actor_profile_id, authority_kind,
			target_unit_id, subject_kind, subject_id, created_at
		) values ($1, $2, 'rules', $3, 'platform', $4, 'content_label', $5, $6)`,
		[id, action, OfficialProfileIds.moderation, TargetUnitId, NsfwLabelId, Timestamp],
	);
	await client.query(
		`insert into public.governance_decision_rule (
			decision_id, rule_source_realm_id, rule_revision_id, rule_id, created_at
		) values ($1, $2, $3, $4, $5)`,
		[id, RealmId, RuleRevisionId, RuleId, Timestamp],
	);
	await client.query("update public.governance_decision set finalized = true where id = $1", [id]);
	await client.query("set constraints all immediate");
}

async function setContentLabelDecision(client: Client, id: string | null): Promise<void> {
	await client.query("select set_config($1, $2, true)", [
		"rezics.content_label_governance_decision_id",
		id ?? "",
	]);
}

async function readContentLabelProjection(client: Client): Promise<{
	readonly authorCreator: string | null;
	readonly authorRows: string;
	readonly effectiveRows: string;
	readonly governedCreator: string | null;
	readonly governedPosition: string | null;
	readonly governedRows: string;
}> {
	return queryOne(
		client,
		`select
			(select created_by_profile_id::text from public.unit_tag
			 where unit_id = $1 and tag_id = $2) as "authorCreator",
			(select count(*) from public.unit_tag
			 where unit_id = $1 and tag_id = $2)::text as "authorRows",
			(select created_by_profile_id::text from public.unit_tag
			 where unit_id = $3 and tag_id = $4) as "governedCreator",
			(select position from public.unit_tag
			 where unit_id = $3 and tag_id = $4) as "governedPosition",
			(select count(*) from public.unit_tag
			 where unit_id = $3 and tag_id = $4)::text as "governedRows",
			(select count(*) from public.current_unit_effective_tag
			 where (unit_id, tag_id) in (($1::uuid, $2::uuid), ($3::uuid, $4::uuid)))::text
				as "effectiveRows"`,
		[ContextPostId, ContentSpoilerMinorId, TargetUnitId, NsfwLabelId],
	);
}

async function verifyContentLabelAndTagPolicyGuards(client: Client): Promise<void> {
	const labelRows = await client.query<{
		readonly directlyApplicable: boolean;
		readonly id: string;
	}>(
		`select id, directly_applicable as "directlyApplicable"
		from public.tag where id = any($1::uuid[]) order by id`,
		[ContentLabelRegistryManifest.map(({ id }) => id)],
	);
	assert(
		ContentLabelRegistryManifest.length === 4 &&
			labelRows.rows.length === 4 &&
			labelRows.rows.every(({ directlyApplicable }) => !directlyApplicable),
		"The fixed content-label registry must contain exactly four non-picker Tag identities",
	);

	for (const [sourceUnitId, targetUnitId] of [
		[ContentLabelRegistryManifest[0].id, TargetUnitId],
		[TargetUnitId, ContentLabelRegistryManifest[0].id],
	] as const)
		await expectDatabaseError(
			client,
			() =>
				client.query(
					`insert into public.unit_merge_operation (
						id, request_id, source_unit_id, target_unit_id
					) values ($1, $2, $3, $4)`,
					[TagAId, TagBId, sourceUnitId, targetUnitId],
				),
			{ code: "23514", constraint: "content_label_unit_merge_rejected" },
			"A fixed content-label registry Unit must be rejected from either merge endpoint",
		);

	for (const relation of ["unit_tag", "realm_unit_tag", "profile_unit_tag"] as const) {
		const operation =
			relation === "unit_tag"
				? () =>
						client.query(
							`insert into public.unit_tag (
							unit_id, tag_id, created_by_profile_id, pinned, position
						) values ($1, $2, $3, false, null)`,
							[TargetUnitId, NonDirectTagId, ProfileIds[0]],
						)
				: relation === "realm_unit_tag"
					? () =>
							client.query(
								`insert into public.realm_unit_tag (
								realm_id, unit_id, tag_id, created_by_profile_id
							) values ($1, $2, $3, $4)`,
								[RealmId, TargetUnitId, NonDirectTagId, ProfileIds[0]],
							)
					: () =>
							client.query(
								`insert into public.profile_unit_tag (profile_id, unit_id, tag_id)
							values ($1, $2, $3)`,
								[ProfileIds[0], TargetUnitId, NonDirectTagId],
							);
		await expectDatabaseError(
			client,
			operation,
			{ code: "23514", constraint: "tag_directly_applicable" },
			`Category-only Tags must reject direct ${relation} application`,
		);
	}

	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.realm_tag_judgment (
					realm_id, unit_id, tag_id, profile_id, fit_vote, fit_updated_at
				) values ($1, $2, $3, $4, 1, $5)`,
				[RealmId, TargetUnitId, NonDirectTagId, ProfileIds[0], Timestamp],
			),
		{ code: "23514", constraint: "tag_directly_applicable" },
		"Category-only Tags must reject direct Realm judgments",
	);

	const enabledForTransition = await client.query(
		"update public.tag set directly_applicable = true where id = $1",
		[NonDirectTagId],
	);
	assert(
		enabledForTransition.rowCount === 1,
		"The transition fixture Tag was not enabled for direct application",
	);
	await client.query(
		`insert into public.unit_tag (
			unit_id, tag_id, created_by_profile_id, pinned, position
		) values ($1, $2, $3, false, null)`,
		[TargetUnitId, NonDirectTagId, ProfileIds[0]],
	);
	await expectDatabaseError(
		client,
		() =>
			client.query("update public.tag set directly_applicable = false where id = $1", [
				NonDirectTagId,
			]),
		{ code: "23514", constraint: "tag_directly_applicable_in_use" },
		"A Tag with an existing direct application must reject a true-to-false transition",
	);
	await client.query("delete from public.unit_tag where unit_id = $1 and tag_id = $2", [
		TargetUnitId,
		NonDirectTagId,
	]);
	const disabledAfterRemoval = await client.query(
		"update public.tag set directly_applicable = false where id = $1",
		[NonDirectTagId],
	);
	assert(
		disabledAfterRemoval.rowCount === 1,
		"A Tag must become category-only after its final direct application is removed",
	);

	await client.query(
		`insert into public.realm_tag_context (
			realm_id, tag_id, context_post_id, created_by_profile_id
		) values ($1, $2, $3, $4)`,
		[RealmId, TagEId, ContextPostId, ProfileIds[0]],
	);
	await client.query(
		`insert into public.realm_tag_judgment (
			realm_id, unit_id, tag_id, profile_id, fit_vote, fit_updated_at
		) values ($1, $2, $3, $4, 1, $5)`,
		[RealmId, TargetUnitId, TagEId, ProfileIds[0], Timestamp],
	);
	await expectDatabaseError(
		client,
		() => client.query("update public.tag set directly_applicable = false where id = $1", [TagEId]),
		{ code: "23514", constraint: "tag_directly_applicable_in_use" },
		"A Tag with Realm judgment evidence must reject a true-to-false transition",
	);
	await client.query(
		`delete from public.realm_tag_judgment
		where realm_id = $1 and unit_id = $2 and tag_id = $3 and profile_id = $4`,
		[RealmId, TargetUnitId, TagEId, ProfileIds[0]],
	);
	await client.query("delete from public.realm_tag_context where realm_id = $1 and tag_id = $2", [
		RealmId,
		TagEId,
	]);
	const disabledAfterRealmEvidenceRemoval = await client.query(
		"update public.tag set directly_applicable = false where id = $1",
		[TagEId],
	);
	assert(
		disabledAfterRealmEvidenceRemoval.rowCount === 1,
		"A Tag must become category-only after its final Realm judgment is removed",
	);
	const restoredRealmEvidenceTag = await client.query(
		"update public.tag set directly_applicable = true where id = $1",
		[TagEId],
	);
	assert(
		restoredRealmEvidenceTag.rowCount === 1,
		"The Realm judgment transition fixture Tag was not restored",
	);

	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag (
					unit_id, tag_id, created_by_profile_id, pinned, position
				) values ($1, $2, $3, false, null)`,
				[ContextPostId, ContentSpoilerMinorId, ProfileIds[0]],
			),
		{ code: "23514", constraint: "content_label_pinned" },
		"Global content-label rows must be pinned",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag (
					unit_id, tag_id, created_by_profile_id, pinned, position
				) values ($1, $2, $3, true, 'a1')`,
				[TargetUnitId, ContentSpoilerMinorId, ProfileIds[0]],
			),
		{ code: "23514", constraint: "content_spoiler_label_post_kind" },
		"Content-spoiler labels must reject non-Post catalog Units",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.profile_unit_tag (profile_id, unit_id, tag_id)
				values ($1, $2, $3)`,
				[ProfileIds[0], ContextPostId, ContentSpoilerMinorId],
			),
		{ code: "23514", constraint: "content_label_private_rejected" },
		"Content labels must never become private Profile Tags",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag (
					unit_id, tag_id, created_by_profile_id, pinned, position
				) values ($1, $2, null, true, 'a2')`,
				[ContextPostId, ContentLabelRegistryManifest[0].id],
			),
		{ code: "23514", constraint: "content_label_creator_required" },
		"Every registry content-label assertion must identify its governing creator",
	);
	await client.query(
		`insert into public.unit_tag (
			unit_id, tag_id, created_by_profile_id, pinned, position, created_at, updated_at
		) values ($1, $2, $3, true, 'a0', $4, $4)`,
		[ContextPostId, ContentSpoilerMinorId, ProfileIds[0], Timestamp],
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag_judgment (
					unit_id, tag_id, profile_id, spoiler_level, spoiler_updated_at
				) values ($1, $2, $3, 1, $4)`,
				[ContextPostId, ContentSpoilerMinorId, ProfileIds[1], Timestamp],
			),
		{ code: "23514", constraint: "content_label_judgment_rejected" },
		"Registry Tags must reject global applicability and spoiler judgments",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.realm_tag_judgment (
					realm_id, unit_id, tag_id, profile_id, spoiler_level, spoiler_updated_at
				) values ($1, $2, $3, $4, 1, $5)`,
				[RealmId, ContextPostId, ContentSpoilerMinorId, ProfileIds[1], Timestamp],
			),
		{ code: "23514", constraint: "content_label_judgment_rejected" },
		"Registry Tags must reject Realm applicability and spoiler judgments",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag (
					unit_id, tag_id, created_by_profile_id, pinned, position
				) values ($1, $2, $3, true, 'a0')`,
				[DraftUnitId, NsfwLabelId, ProfileIds[0]],
			),
		{ code: "23514", constraint: "nsfw_label_public_content" },
		"NSFW labels must reject inactive or non-public content Units",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.unit_tag (
					unit_id, tag_id, created_by_profile_id, pinned, position
				) values ($1, $2, $3, true, 'a0')`,
				[TargetUnitId, NsfwLabelId, OfficialProfileIds.moderation],
			),
		{ code: "23514", constraint: "content_label_platform_apply" },
		"Official platform label rows must require a finalized governance decision",
	);

	await createContentLabelDecision(client, ContentLabelApplyDecisionId, "content_label.apply");
	await setContentLabelDecision(client, ContentLabelApplyDecisionId);
	await client.query(
		`insert into public.unit_tag (
			unit_id, tag_id, created_by_profile_id, pinned, position, created_at, updated_at
		) values ($1, $2, $3, true, 'a0', $4, $4)`,
		[TargetUnitId, NsfwLabelId, OfficialProfileIds.moderation, Timestamp],
	);
	await setContentLabelDecision(client, null);

	const projectionBeforeRejectedTransitions = await readContentLabelProjection(client);
	assert(
		projectionBeforeRejectedTransitions.authorCreator === ProfileIds[0] &&
			projectionBeforeRejectedTransitions.authorRows === "1" &&
			projectionBeforeRejectedTransitions.governedCreator === OfficialProfileIds.moderation &&
			projectionBeforeRejectedTransitions.governedPosition === "a0" &&
			projectionBeforeRejectedTransitions.governedRows === "1" &&
			projectionBeforeRejectedTransitions.effectiveRows === "2",
		"Author and governed content-label projections were not installed exactly once",
	);

	await expectDatabaseError(
		client,
		() =>
			client.query(
				`update public.unit_tag
				set position = 'a1'
				where unit_id = $1 and tag_id = $2 and created_by_profile_id = $3`,
				[TargetUnitId, NsfwLabelId, OfficialProfileIds.moderation],
			),
		{ code: "23514", constraint: "content_label_platform_identity" },
		"A platform content-label replacement must require a matching finalized decision",
	);
	const projectionAfterRejectedReplacement = await readContentLabelProjection(client);
	assert(
		JSON.stringify(projectionAfterRejectedReplacement) ===
			JSON.stringify(projectionBeforeRejectedTransitions),
		"A rejected platform content-label replacement changed its source or effective projection",
	);

	const rejectedIdentityTransitions = [
		{
			message: "A governed label row must not escape to an ungoverned creator",
			operation: () =>
				client.query(
					`update public.unit_tag set created_by_profile_id = $1
					where unit_id = $2 and tag_id = $3`,
					[ProfileIds[0], TargetUnitId, NsfwLabelId],
				),
		},
		{
			message: "An ungoverned author row must not become a governed platform row by UPDATE",
			operation: () =>
				client.query(
					`update public.unit_tag set created_by_profile_id = $1
					where unit_id = $2 and tag_id = $3`,
					[OfficialProfileIds.moderation, ContextPostId, ContentSpoilerMinorId],
				),
		},
		{
			message: "A governed label row must not switch between official creators",
			operation: () =>
				client.query(
					`update public.unit_tag set created_by_profile_id = $1
					where unit_id = $2 and tag_id = $3`,
					[OfficialProfileIds.editorial, TargetUnitId, NsfwLabelId],
				),
		},
	] as const;
	for (const transition of rejectedIdentityTransitions) {
		await expectDatabaseError(
			client,
			transition.operation,
			{ code: "23514", constraint: "content_label_platform_identity" },
			transition.message,
		);
		const projectionAfterRejection = await readContentLabelProjection(client);
		assert(
			JSON.stringify(projectionAfterRejection) ===
				JSON.stringify(projectionBeforeRejectedTransitions),
			`${transition.message}; rejected transition changed a source or effective projection`,
		);
	}

	await createContentLabelDecision(client, ContentLabelReplaceDecisionId, "content_label.replace");
	await setContentLabelDecision(client, ContentLabelReplaceDecisionId);
	await client.query(
		`update public.unit_tag
		set position = 'a1', updated_at = $1
		where unit_id = $2 and tag_id = $3 and created_by_profile_id = $4`,
		[Timestamp, TargetUnitId, NsfwLabelId, OfficialProfileIds.moderation],
	);
	await setContentLabelDecision(client, null);
	let projection = await readContentLabelProjection(client);
	assert(
		projection.governedCreator === OfficialProfileIds.moderation &&
			projection.governedPosition === "a1" &&
			projection.governedRows === "1" &&
			projection.effectiveRows === "2",
		"A matching replace decision must permit only an unchanged-identity mutation",
	);

	await expectDatabaseError(
		client,
		() =>
			client.query("delete from public.unit_tag where unit_id = $1 and tag_id = $2", [
				TargetUnitId,
				NsfwLabelId,
			]),
		{ code: "23514", constraint: "content_label_platform_remove" },
		"Platform-created content-label rows must retain platform removal authority",
	);

	await createContentLabelDecision(client, ContentLabelRemoveDecisionId, "content_label.remove");
	await setContentLabelDecision(client, ContentLabelRemoveDecisionId);
	await client.query("delete from public.unit_tag where unit_id = $1 and tag_id = $2", [
		TargetUnitId,
		NsfwLabelId,
	]);
	await setContentLabelDecision(client, null);
	projection = await readContentLabelProjection(client);
	assert(
		projection.authorRows === "1" &&
			projection.governedRows === "0" &&
			projection.governedCreator === null &&
			projection.governedPosition === null &&
			projection.effectiveRows === "1",
		"A matching remove decision must remove the governed source and effective projection",
	);

	await createContentLabelDecision(client, ContentLabelReapplyDecisionId, "content_label.apply");
	await setContentLabelDecision(client, ContentLabelReapplyDecisionId);
	await client.query(
		`insert into public.unit_tag (
			unit_id, tag_id, created_by_profile_id, pinned, position, created_at, updated_at
		) values ($1, $2, $3, true, 'a2', $4, $4)`,
		[TargetUnitId, NsfwLabelId, OfficialProfileIds.moderation, Timestamp],
	);
	await setContentLabelDecision(client, null);
	projection = await readContentLabelProjection(client);
	assert(
		projection.authorRows === "1" &&
			projection.governedRows === "1" &&
			projection.governedCreator === OfficialProfileIds.moderation &&
			projection.governedPosition === "a2" &&
			projection.effectiveRows === "2",
		"A matching apply decision must permit a governed replacement without duplicates",
	);
}

async function upsertCanonicalMeasurement(client: Client): Promise<void> {
	await client.query(
		`insert into public.entity_measurement (
			entity_id, context_unit_id, height_millimetres, source_url,
			source_imported_at, source_provenance, created_at, updated_at
		) values ($1, null, 1610, $2, $3, $4::jsonb, $3, $3)
		on conflict on constraint entity_measurement_entity_context_key do update set
			height_millimetres = excluded.height_millimetres,
			source_url = excluded.source_url,
			source_imported_at = excluded.source_imported_at,
			source_provenance = excluded.source_provenance,
			updated_at = excluded.updated_at`,
		[
			EntityId,
			"https://vndb.org/c_fixture",
			Timestamp,
			JSON.stringify({ importer: "vndb-v11", sourceId: "c_fixture" }),
		],
	);
}

async function verifyMeasurements(client: Client): Promise<void> {
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, source_url, source_imported_at, source_provenance
				) values ($1, null, $2, $3, $4::jsonb)`,
				[
					EntityId,
					"https://vndb.org/c_fixture",
					Timestamp,
					JSON.stringify({ importer: "vndb-v11" }),
				],
			),
		{ code: "23514", constraint: "entity_measurement_value_present_check" },
		"Entity measurements must contain at least one known point value",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, height_millimetres, source_url,
					source_imported_at, source_provenance
				) values ($1, null, 0, $2, $3, $4::jsonb)`,
				[
					EntityId,
					"https://vndb.org/c_fixture",
					Timestamp,
					JSON.stringify({ importer: "vndb-v11" }),
				],
			),
		{ code: "23514", constraint: "entity_measurement_positive_check" },
		"Entity measurement values must be positive canonical integers",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, height_millimetres, source_url,
					source_imported_at, source_provenance
				) values ($1, $1, 1600, $2, $3, $4::jsonb)`,
				[
					EntityId,
					"https://vndb.org/c_fixture",
					Timestamp,
					JSON.stringify({ importer: "vndb-v11" }),
				],
			),
		{ code: "23514", constraint: "entity_measurement_context_not_self_check" },
		"An Entity measurement context must be a different Unit",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, height_millimetres, source_url,
					source_imported_at, source_provenance
				) values ($1, null, 1600, '   ', $2, $3::jsonb)`,
				[EntityId, Timestamp, JSON.stringify({ importer: "vndb-v11" })],
			),
		{ code: "23514", constraint: "entity_measurement_source_url_check" },
		"Entity measurement provenance must retain a non-empty source URL",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, height_millimetres, source_url,
					source_imported_at, source_provenance
				) values ($1, null, 1600, $2, $3, '[]'::jsonb)`,
				[EntityId, "https://vndb.org/c_fixture", Timestamp],
			),
		{ code: "23514", constraint: "entity_measurement_source_provenance_check" },
		"Entity measurement provenance must retain a structured JSON object",
	);
	await client.query(
		`insert into public.entity_measurement (
			entity_id, context_unit_id, height_millimetres, source_url,
			source_imported_at, source_provenance, created_at, updated_at
		) values ($1, null, 1600, $2, $3, $4::jsonb, $3, $3)`,
		[
			EntityId,
			"https://vndb.org/c_fixture",
			Timestamp,
			JSON.stringify({ importer: "vndb-v11", sourceId: "c_fixture" }),
		],
	);
	await upsertCanonicalMeasurement(client);
	await upsertCanonicalMeasurement(client);
	let canonical = await queryOne<{ readonly count: string; readonly height: number }>(
		client,
		`select count(*)::text as count, max(height_millimetres)::integer as height
		from public.entity_measurement
		where entity_id = $1 and context_unit_id is null`,
		[EntityId],
	);
	assert(
		canonical.count === "1" && canonical.height === 1610,
		"Canonical measurement upserts must be idempotent under NULLS NOT DISTINCT identity",
	);

	for (const [index, contextUnitId] of MeasurementContextIds.slice(0, 8).entries())
		await client.query(
			`insert into public.entity_measurement (
				entity_id, context_unit_id, weight_grams, source_url,
				source_imported_at, source_provenance
			) values ($1, $2, $3, $4, $5, $6::jsonb)`,
			[
				EntityId,
				contextUnitId,
				50_000 + index,
				`https://vndb.org/r_fixture_${index}`,
				Timestamp,
				JSON.stringify({ importer: "vndb-v11", context: index }),
			],
		);
	const contextualUpsertAtCap = await client.query(
		`insert into public.entity_measurement (
			entity_id, context_unit_id, weight_grams, source_url,
			source_imported_at, source_provenance, created_at, updated_at
		) values ($1, $2, 51000, $3, $4, $5::jsonb, $4, $4)
		on conflict on constraint entity_measurement_entity_context_key do update set
			weight_grams = excluded.weight_grams,
			source_url = excluded.source_url,
			source_imported_at = excluded.source_imported_at,
			source_provenance = excluded.source_provenance,
			updated_at = excluded.updated_at`,
		[
			EntityId,
			MeasurementContextIds[0],
			"https://vndb.org/r_fixture_0_updated",
			Timestamp,
			JSON.stringify({ importer: "vndb-v11", context: 0, updated: true }),
		],
	);
	assert(
		contextualUpsertAtCap.rowCount === 1,
		"An existing contextual measurement must remain upsertable at the eight-context cap",
	);
	const contextualAfterUpsert = await queryOne<{
		readonly count: string;
		readonly weight: number;
	}>(
		client,
		`select count(*)::text as count,
			max(weight_grams) filter (where context_unit_id = $2)::integer as weight
		from public.entity_measurement
		where entity_id = $1 and context_unit_id is not null`,
		[EntityId, MeasurementContextIds[0]],
	);
	assert(
		contextualAfterUpsert.count === "8" && contextualAfterUpsert.weight === 51_000,
		"A contextual upsert at the cap must update in place without consuming a ninth context",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`insert into public.entity_measurement (
					entity_id, context_unit_id, weight_grams, source_url,
					source_imported_at, source_provenance
				) values ($1, $2, 50009, $3, $4, $5::jsonb)`,
				[
					EntityId,
					MeasurementContextIds[8],
					"https://vndb.org/r_fixture_9",
					Timestamp,
					JSON.stringify({ importer: "vndb-v11", context: 9 }),
				],
			),
		{ code: "23514", constraint: "entity_measurement_context_limit" },
		"An Entity must reject a ninth contextual measurement set",
	);
	await expectDatabaseError(
		client,
		() =>
			client.query(
				`update public.entity_measurement
				set context_unit_id = $1
				where entity_id = $2 and context_unit_id is null`,
				[MeasurementContextIds[8], EntityId],
			),
		{ code: "55000", constraint: "entity_measurement_identity_immutable" },
		"Measurement canonical/context identity must be immutable",
	);
	canonical = await queryOne<{ readonly count: string; readonly height: number }>(
		client,
		`select count(*)::text as count, max(height_millimetres)::integer as height
		from public.entity_measurement where entity_id = $1`,
		[EntityId],
	);
	assert(
		canonical.count === "9" && canonical.height === 1610,
		"Measurement fixture must retain one canonical plus exactly eight contextual sets",
	);
}

async function verifyIdempotentJudgmentUpserts(client: Client): Promise<void> {
	for (let pass = 0; pass < 2; pass++) {
		await client.query(
			`insert into public.unit_tag_judgment (
				unit_id, tag_id, profile_id, spoiler_level, spoiler_updated_at
			) values ($1, $2, $3, 1, $4)
			on conflict (unit_id, tag_id, profile_id) do update set
				spoiler_level = excluded.spoiler_level,
				spoiler_updated_at = excluded.spoiler_updated_at,
				updated_at = excluded.spoiler_updated_at`,
			[TargetUnitId, DirectTagId, ProfileIds[2], Timestamp],
		);
		await client.query(
			`insert into public.unit_structure_application_judgment (
				unit_id, structure_id, profile_id, spoiler_level, spoiler_updated_at
			) values ($1, $2, $3, 1, $4)
			on conflict (unit_id, structure_id, profile_id) do update set
				spoiler_level = excluded.spoiler_level,
				spoiler_updated_at = excluded.spoiler_updated_at,
				updated_at = excluded.spoiler_updated_at`,
			[TargetUnitId, PathOneId, ProfileIds[2], Timestamp],
		);
		await client.query(
			`insert into public.realm_tag_judgment (
				realm_id, unit_id, tag_id, profile_id, spoiler_level, spoiler_updated_at
			) values ($1, $2, $3, $4, 2, $5)
			on conflict (realm_id, unit_id, tag_id, profile_id) do update set
				spoiler_level = excluded.spoiler_level,
				spoiler_updated_at = excluded.spoiler_updated_at,
				updated_at = excluded.spoiler_updated_at`,
			[RealmId, TargetUnitId, RealmTagId, ProfileIds[2], Timestamp],
		);
		await client.query(
			`insert into public.subject_association_judgment (
				association_id, profile_id, spoiler_level, created_at, updated_at
			) values ($1, $2, 0, $3, $3)
			on conflict (association_id, profile_id) do update set
				spoiler_level = excluded.spoiler_level,
				updated_at = excluded.updated_at`,
			[SubjectAssociationId, ProfileIds[1], Timestamp],
		);
		await upsertCanonicalMeasurement(client);
	}

	const sourceCounts = await queryOne<{
		readonly direct: string;
		readonly measurement: string;
		readonly path: string;
		readonly realm: string;
		readonly subject: string;
	}>(
		client,
		`select
			(select count(*) from public.unit_tag_judgment
			 where unit_id = $1 and tag_id = $2 and profile_id = $3)::text as direct,
			(select count(*) from public.unit_structure_application_judgment
			 where unit_id = $1 and structure_id = $4 and profile_id = $3)::text as path,
			(select count(*) from public.realm_tag_judgment
			 where realm_id = $5 and unit_id = $1 and tag_id = $6 and profile_id = $3)::text as realm,
			(select count(*) from public.subject_association_judgment
			 where association_id = $7 and profile_id = $8)::text as subject,
			(select count(*) from public.entity_measurement
			 where entity_id = $9 and context_unit_id is null)::text as measurement`,
		[
			TargetUnitId,
			DirectTagId,
			ProfileIds[2],
			PathOneId,
			RealmId,
			RealmTagId,
			SubjectAssociationId,
			ProfileIds[1],
			EntityId,
		],
	);
	assert(
		Object.values(sourceCounts).every((count) => count === "1"),
		`Repeated upserts must not duplicate source facts; received ${JSON.stringify(sourceCounts)}`,
	);
	assertAggregate(
		await readUnitTagAggregate(client, DirectTagId),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 1, minor: 1, major: 0 },
		"Repeated direct upserts must not duplicate aggregates",
	);
	assertAggregate(
		await readPathAggregate(client),
		{ score: 1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Repeated Path upserts must not duplicate aggregates",
	);
	assertAggregate(
		await readRealmAggregate(client),
		{ score: -1, voteCount: 1, spoilerCount: 2, none: 0, minor: 1, major: 1 },
		"Repeated Realm upserts must not duplicate aggregates",
	);
	assertSubjectAggregate(
		await readSubjectAggregate(client),
		{ none: 1, minor: 1, major: 0 },
		"Repeated subject-association upserts must not duplicate aggregates",
	);
}

async function assertSourceAggregateParity(
	client: Client,
	message: string,
	query: string,
	values: readonly unknown[],
): Promise<void> {
	const result = await queryOne<{ readonly matches: boolean }>(client, query, values);
	assert(result.matches, message);
}

async function verifySourceAggregateParity(client: Client): Promise<void> {
	await assertSourceAggregateParity(
		client,
		"Direct Tag aggregate diverged from effective fit facts or sparse spoiler facts",
		`select
			stat.score = coalesce((select sum(vote.value) from public.current_unit_effective_tag_vote as vote
				where vote.unit_id = stat.unit_id and vote.tag_id = stat.tag_id), 0)
			and stat.vote_count = (select count(*) from public.current_unit_effective_tag_vote as vote
				where vote.unit_id = stat.unit_id and vote.tag_id = stat.tag_id)
			and stat.spoiler_vote_count = (select count(judgment.spoiler_level)
				from public.unit_tag_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.tag_id = stat.tag_id)
			and stat.spoiler_none_count = (select count(*) from public.unit_tag_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.tag_id = stat.tag_id
					and judgment.spoiler_level = 0)
			and stat.spoiler_minor_count = (select count(*) from public.unit_tag_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.tag_id = stat.tag_id
					and judgment.spoiler_level = 1)
			and stat.spoiler_major_count = (select count(*) from public.unit_tag_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.tag_id = stat.tag_id
					and judgment.spoiler_level = 2) as matches
		from public.current_unit_tag_judgment_stat as stat
		where stat.unit_id = $1 and stat.tag_id = $2`,
		[TargetUnitId, DirectTagId],
	);
	await assertSourceAggregateParity(
		client,
		"Path application aggregate diverged from its sparse judgment facts",
		`select
			stat.score = coalesce((select sum(judgment.fit_vote)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id), 0)
			and stat.vote_count = (select count(judgment.fit_vote)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id)
			and stat.spoiler_vote_count = (select count(judgment.spoiler_level)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id)
			and stat.spoiler_none_count = (select count(*)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id
					and judgment.spoiler_level = 0)
			and stat.spoiler_minor_count = (select count(*)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id
					and judgment.spoiler_level = 1)
			and stat.spoiler_major_count = (select count(*)
				from public.unit_structure_application_judgment as judgment
				where judgment.unit_id = stat.unit_id and judgment.structure_id = stat.structure_id
					and judgment.spoiler_level = 2) as matches
		from public.unit_structure_application_judgment_stat as stat
		where stat.unit_id = $1 and stat.structure_id = $2`,
		[TargetUnitId, PathOneId],
	);
	await assertSourceAggregateParity(
		client,
		"Realm Tag aggregate diverged from its separate-authority sparse judgment facts",
		`select
			stat.score = coalesce((select sum(judgment.fit_vote) from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id)), 0)
			and stat.vote_count = (select count(judgment.fit_vote)
				from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id))
			and stat.spoiler_vote_count = (select count(judgment.spoiler_level)
				from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id))
			and stat.spoiler_none_count = (select count(*) from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id) and judgment.spoiler_level = 0)
			and stat.spoiler_minor_count = (select count(*) from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id) and judgment.spoiler_level = 1)
			and stat.spoiler_major_count = (select count(*) from public.realm_tag_judgment as judgment
				where (judgment.realm_id, judgment.unit_id, judgment.tag_id) =
					(stat.realm_id, stat.unit_id, stat.tag_id) and judgment.spoiler_level = 2) as matches
		from public.realm_tag_judgment_stat as stat
		where stat.realm_id = $1 and stat.unit_id = $2 and stat.tag_id = $3`,
		[RealmId, TargetUnitId, RealmTagId],
	);
	await assertSourceAggregateParity(
		client,
		"Subject-association aggregate diverged from its spoiler-only judgment facts",
		`select
			stat.spoiler_vote_count = count(judgment.spoiler_level)
			and stat.spoiler_none_count = count(*) filter (where judgment.spoiler_level = 0)
			and stat.spoiler_minor_count = count(*) filter (where judgment.spoiler_level = 1)
			and stat.spoiler_major_count = count(*) filter (where judgment.spoiler_level = 2) as matches
		from public.subject_association_judgment_stat as stat
		join public.subject_association_judgment as judgment
			on judgment.association_id = stat.association_id
		where stat.association_id = $1
		group by stat.association_id, stat.spoiler_vote_count, stat.spoiler_none_count,
			stat.spoiler_minor_count, stat.spoiler_major_count`,
		[SubjectAssociationId],
	);
}

interface ConcurrentHotKeyState extends QueryResultRow {
	readonly applicationJudgments: string;
	readonly applicationRows: string;
	readonly applicationStats: string;
	readonly directFit: number | null;
	readonly directSpoiler: number | null;
	readonly effectiveDirect: boolean;
	readonly effectiveRows: string;
	readonly effectiveStructureSupportCount: string;
	readonly effectiveVotes: string;
	readonly major: string | null;
	readonly minor: string | null;
	readonly none: string | null;
	readonly score: string | null;
	readonly spoilerCount: string | null;
	readonly structureSupports: string;
	readonly tagStats: string;
	readonly voteCount: string | null;
}

const ConcurrentInitialState: ConcurrentHotKeyState = {
	applicationJudgments: "1",
	applicationRows: "1",
	applicationStats: "1",
	directFit: 1,
	directSpoiler: 1,
	effectiveDirect: true,
	effectiveRows: "1",
	effectiveStructureSupportCount: "1",
	effectiveVotes: "1",
	major: "0",
	minor: "1",
	none: "0",
	score: "1",
	spoilerCount: "1",
	structureSupports: "3",
	tagStats: "1",
	voteCount: "1",
};

const ConcurrentFinalState: ConcurrentHotKeyState = {
	applicationJudgments: "0",
	applicationRows: "0",
	applicationStats: "0",
	directFit: null,
	directSpoiler: 1,
	effectiveDirect: true,
	effectiveRows: "1",
	effectiveStructureSupportCount: "0",
	effectiveVotes: "0",
	major: "0",
	minor: "1",
	none: "0",
	score: "0",
	spoilerCount: "1",
	structureSupports: "0",
	tagStats: "1",
	voteCount: "0",
};

async function readConcurrentHotKeyState(client: Client): Promise<ConcurrentHotKeyState> {
	return queryOne(
		client,
		`select
			(select fit_vote from public.unit_tag_judgment
			 where unit_id = $1 and tag_id = $2 and profile_id = $4) as "directFit",
			(select spoiler_level from public.unit_tag_judgment
			 where unit_id = $1 and tag_id = $2 and profile_id = $4) as "directSpoiler",
			(select count(*) from public.unit_structure_application
			 where unit_id = $1 and structure_id = $3)::text as "applicationRows",
			(select count(*) from public.unit_structure_application_judgment
			 where unit_id = $1 and structure_id = $3 and profile_id = $4)::text
				as "applicationJudgments",
			(select count(*) from public.unit_structure_application_judgment_stat
			 where unit_id = $1 and structure_id = $3)::text as "applicationStats",
			(select count(*) from public.current_unit_tag_structure_support
			 where unit_id = $1 and structure_id = $3 and profile_id = $4)::text
				as "structureSupports",
			(select count(*) from public.current_unit_effective_tag_vote
			 where unit_id = $1 and tag_id = $2 and profile_id = $4)::text as "effectiveVotes",
			(select count(*) from public.current_unit_effective_tag
			 where unit_id = $1 and tag_id = $2)::text as "effectiveRows",
			coalesce((select direct from public.current_unit_effective_tag
			 where unit_id = $1 and tag_id = $2), false) as "effectiveDirect",
			coalesce((select structure_support_count from public.current_unit_effective_tag
			 where unit_id = $1 and tag_id = $2), 0)::text as "effectiveStructureSupportCount",
			(select count(*) from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2)::text as "tagStats",
			(select score::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as score,
			(select vote_count::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as "voteCount",
			(select spoiler_vote_count::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as "spoilerCount",
			(select spoiler_none_count::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as none,
			(select spoiler_minor_count::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as minor,
			(select spoiler_major_count::text from public.current_unit_tag_judgment_stat
			 where unit_id = $1 and tag_id = $2) as major`,
		[TargetUnitId, TagAId, PathOneId, ProfileIds[0]],
	);
}

async function assertConcurrentHotKeyState(
	client: Client,
	expected: ConcurrentHotKeyState,
	message: string,
): Promise<void> {
	const actual = await readConcurrentHotKeyState(client);
	assert(
		Object.entries(expected).every(
			([key, value]) => actual[key as keyof ConcurrentHotKeyState] === value,
		),
		`${message}; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
	);
}

async function assertHasAdvisoryTransactionLocks(client: Client, message: string): Promise<void> {
	const row = await queryOne<{ readonly count: string }>(
		client,
		`select count(*)::text as count from pg_catalog.pg_locks
		where pid = pg_backend_pid() and locktype = 'advisory' and granted`,
	);
	assert(
		Number.parseInt(row.count, 10) > 0,
		`${message}; session held no granted advisory transaction locks`,
	);
}

async function assertNoAdvisoryTransactionLocks(client: Client, message: string): Promise<void> {
	const row = await queryOne<{ readonly count: string }>(
		client,
		`select count(*)::text as count from pg_catalog.pg_locks
		where pid = pg_backend_pid() and locktype = 'advisory' and granted`,
	);
	assert(row.count === "0", `${message}; session retained ${row.count} advisory locks`);
}

async function resetConcurrentHotKey(client: Client): Promise<void> {
	await client.query(
		`insert into public.unit_tag_judgment (
			unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		) values ($1, $2, $3, 1, 1, $4, $4, $4, $4)
		on conflict (unit_id, tag_id, profile_id) do update set
			fit_vote = excluded.fit_vote,
			spoiler_level = excluded.spoiler_level,
			fit_updated_at = excluded.fit_updated_at,
			spoiler_updated_at = excluded.spoiler_updated_at,
			updated_at = excluded.updated_at`,
		[TargetUnitId, TagAId, ProfileIds[0], Timestamp],
	);
	await client.query(
		`insert into public.unit_structure_application (
			unit_id, structure_id, created_by_profile_id, pinned, position, created_at, updated_at
		) values ($1, $2, $3, false, null, $4, $4)
		on conflict (unit_id, structure_id) do nothing`,
		[TargetUnitId, PathOneId, ProfileIds[0], Timestamp],
	);
	await client.query(
		`insert into public.unit_structure_application_judgment (
			unit_id, structure_id, profile_id, fit_vote, fit_updated_at, created_at, updated_at
		) values ($1, $2, $3, 1, $4, $4, $4)
		on conflict (unit_id, structure_id, profile_id) do update set
			fit_vote = excluded.fit_vote,
			fit_updated_at = excluded.fit_updated_at,
			updated_at = excluded.updated_at`,
		[TargetUnitId, PathOneId, ProfileIds[0], Timestamp],
	);
	await assertConcurrentHotKeyState(
		client,
		ConcurrentInitialState,
		"Concurrent hot-key fixture reset is inconsistent",
	);
}

async function beginHotKeyTransaction(client: Client): Promise<void> {
	await client.query("begin");
	await client.query("set local statement_timeout = '2s'");
}

async function clearConcurrentDirectFit(client: Client): Promise<void> {
	const result = await client.query(
		`update public.unit_tag_judgment
		set fit_vote = null, fit_updated_at = null, updated_at = $1
		where unit_id = $2 and tag_id = $3 and profile_id = $4`,
		[Timestamp, TargetUnitId, TagAId, ProfileIds[0]],
	);
	assert(result.rowCount === 1, "Concurrent direct fit mutation did not update exactly one row");
}

async function deleteConcurrentApplication(client: Client): Promise<void> {
	const result = await client.query(
		`delete from public.unit_structure_application
		where unit_id = $1 and structure_id = $2`,
		[TargetUnitId, PathOneId],
	);
	assert(result.rowCount === 1, "Concurrent application cascade did not delete exactly one row");
}

async function cleanupCommittedFixture(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query(
			`update public.unit_structure_correction_activation
			set job_id = null, lease_owner = null, lease_token = null, lease_expires_at = null
			where job_id in (
				select id from public.unit_structure_correction
				where structure_id = any($1::uuid[])
			)`,
			[[PathOneId, PathTwoId]],
		);
		await client.query(
			`delete from public.unit_structure_correction
			where structure_id = any($1::uuid[])`,
			[[PathOneId, PathTwoId]],
		);
		await client.query("delete from public.platform_capability_grant where id = $1", [
			CorrectionCapabilityGrantId,
		]);
		await client.query("delete from public.unit_revision_head where unit_id = any($1::uuid[])", [
			FixtureUnitIds,
		]);
		await client.query("delete from public.unit_revision where unit_id = any($1::uuid[])", [
			FixtureUnitIds,
		]);
		await client.query("alter table public.audit_event disable trigger audit_event_append_only");
		await client.query("delete from public.audit_event where actor_profile_id = any($1::uuid[])", [
			ProfileIds,
		]);
		await client.query("alter table public.audit_event enable trigger audit_event_append_only");
		await client.query("delete from public.unit where id = any($1::uuid[])", [FixtureUnitIds]);
		await client.query("delete from public.users where id = any($1::uuid[])", [FixtureAuthUserIds]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function verifyConcurrentHotKeyLocking(
	fixtureClient: Client,
	connectionString: string,
): Promise<void> {
	const directClient = new Client({
		connectionString,
		application_name: "rezics-vndb-v11-direct-lock-check",
	});
	const applicationClient = new Client({
		connectionString,
		application_name: "rezics-vndb-v11-application-lock-check",
	});
	let fixtureCommitted = false;
	let directTransactionOpen = false;
	let applicationTransactionOpen = false;
	try {
		await fixtureClient.query("begin");
		try {
			await seedOwnersAndUnits(fixtureClient);
			await seedRelationships(fixtureClient);
			await fixtureClient.query("commit");
			fixtureCommitted = true;
		} catch (error) {
			await fixtureClient.query("rollback");
			throw error;
		}
		await resetConcurrentHotKey(fixtureClient);
		await Promise.all([directClient.connect(), applicationClient.connect()]);

		await beginHotKeyTransaction(directClient);
		directTransactionOpen = true;
		await clearConcurrentDirectFit(directClient);
		await assertHasAdvisoryTransactionLocks(
			directClient,
			"The direct mutation blocker must retain its canonical hot-key locks",
		);
		await beginHotKeyTransaction(applicationClient);
		applicationTransactionOpen = true;
		await expectDatabaseError(
			applicationClient,
			() => deleteConcurrentApplication(applicationClient),
			{ code: "55P03", constraint: "vndb_vote_hot_key_busy" },
			"An application cascade must fail fast while a direct mutation holds its hot key",
		);
		await assertNoAdvisoryTransactionLocks(
			applicationClient,
			"A failed application cascade must release every partially acquired hot-key lock",
		);
		await assertConcurrentHotKeyState(
			applicationClient,
			ConcurrentInitialState,
			"A busy application cascade must leave every source and projection unchanged",
		);
		await applicationClient.query("rollback");
		applicationTransactionOpen = false;
		await directClient.query("commit");
		directTransactionOpen = false;
		await beginHotKeyTransaction(applicationClient);
		applicationTransactionOpen = true;
		await deleteConcurrentApplication(applicationClient);
		await applicationClient.query("commit");
		applicationTransactionOpen = false;
		await assertConcurrentHotKeyState(
			fixtureClient,
			ConcurrentFinalState,
			"Application retry after direct commit must converge exactly",
		);

		await resetConcurrentHotKey(fixtureClient);
		await beginHotKeyTransaction(applicationClient);
		applicationTransactionOpen = true;
		await deleteConcurrentApplication(applicationClient);
		await assertHasAdvisoryTransactionLocks(
			applicationClient,
			"The application cascade blocker must retain its canonical hot-key locks",
		);
		await beginHotKeyTransaction(directClient);
		directTransactionOpen = true;
		await expectDatabaseError(
			directClient,
			() => clearConcurrentDirectFit(directClient),
			{ code: "55P03", constraint: "vndb_vote_hot_key_busy" },
			"A direct mutation must fail fast while an application cascade holds its hot key",
		);
		await assertNoAdvisoryTransactionLocks(
			directClient,
			"A failed direct mutation must release every partially acquired hot-key lock",
		);
		await assertConcurrentHotKeyState(
			directClient,
			ConcurrentInitialState,
			"A busy direct mutation must leave every source and projection unchanged",
		);
		await directClient.query("rollback");
		directTransactionOpen = false;
		await applicationClient.query("commit");
		applicationTransactionOpen = false;
		await beginHotKeyTransaction(directClient);
		directTransactionOpen = true;
		await clearConcurrentDirectFit(directClient);
		await directClient.query("commit");
		directTransactionOpen = false;
		await assertConcurrentHotKeyState(
			fixtureClient,
			ConcurrentFinalState,
			"Direct retry after application commit must converge exactly",
		);
	} finally {
		if (directTransactionOpen) await directClient.query("rollback");
		if (applicationTransactionOpen) await applicationClient.query("rollback");
		await Promise.allSettled([directClient.end(), applicationClient.end()]);
		if (fixtureCommitted) await cleanupCommittedFixture(fixtureClient);
	}
}

function rememberCorrectionStatus(statuses: CorrectionStatus[], status: CorrectionStatus): void {
	if (statuses.at(-1) !== status) statuses.push(status);
}

async function assertCorrectionControlsReady(client: Client): Promise<void> {
	const controls = await queryOne<{
		readonly activationCount: string;
		readonly activationJobId: string | null;
		readonly admissionOpen: boolean | null;
		readonly policyCount: string;
		readonly routingEpoch: string | null;
	}>(
		client,
		`select
			(select count(*)::text from public.unit_structure_correction_policy where id) as "policyCount",
			(select admission_open from public.unit_structure_correction_policy where id) as "admissionOpen",
			(select count(*)::text from public.unit_structure_correction_activation where id)
				as "activationCount",
			(select job_id::text from public.unit_structure_correction_activation where id)
				as "activationJobId",
			(select routing_epoch::text from public.unit_structure_correction_activation where id)
				as "routingEpoch"`,
	);
	assert(
		controls.policyCount === "1" &&
			controls.admissionOpen === true &&
			controls.activationCount === "1" &&
			controls.activationJobId === null &&
			controls.routingEpoch !== null &&
			Number.parseInt(controls.routingEpoch, 10) > 0,
		`Structure correction control singletons are not ready; received ${JSON.stringify(controls)}`,
	);
}

async function seedCorrectionFixture(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await seedOwnersAndUnits(client);
		await seedRelationships(client);
		await client.query(
			`insert into public.platform_capability_grant (
				id, profile_id, capability, granted_by_profile_id, created_at, updated_at
			) values ($1, $2, 'unit.edit', $2, $3, $3)`,
			[CorrectionCapabilityGrantId, ProfileIds[0], Timestamp],
		);
		await resetConcurrentHotKey(client);
		await client.query(
			`insert into public.unit_structure_vote (
				structure_id, profile_id, value, created_at, updated_at
			) values ($1, $2, 1, $3, $3)`,
			[PathOneId, ProfileIds[0], Timestamp],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function assertCurrentCorrectionPath(
	client: Client,
	expectedProjectionVersion: number,
	expectedMembers: readonly string[],
	expectedLeafTagId: string,
): Promise<void> {
	const header = await queryOne<{
		readonly activeProjectionVersion: number;
		readonly memberUnitIds: string[];
	}>(
		client,
		`select active_projection_version as "activeProjectionVersion",
			member_unit_ids as "memberUnitIds"
		from public.unit_structure where id = $1`,
		[PathOneId],
	);
	assert(
		header.activeProjectionVersion === expectedProjectionVersion &&
			header.memberUnitIds.join(",") === expectedMembers.join(","),
		`Structure header is not on projection ${expectedProjectionVersion}; received ${JSON.stringify(header)}`,
	);

	const members = await client.query<{
		readonly memberUnitId: string;
		readonly ordinal: number;
		readonly projectionVersion: number;
	}>(
		`select projection_version as "projectionVersion", ordinal,
			member_unit_id as "memberUnitId"
		from public.current_unit_structure_member
		where structure_id = $1 order by ordinal`,
		[PathOneId],
	);
	assert(
		members.rows.length === expectedMembers.length &&
			members.rows.every(
				(row, ordinal) =>
					row.projectionVersion === expectedProjectionVersion &&
					row.ordinal === ordinal &&
					row.memberUnitId === expectedMembers[ordinal],
			),
		`Current Structure members are not the exact projection ${expectedProjectionVersion}`,
	);

	const edges = await client.query<{
		readonly childUnitId: string;
		readonly ordinal: number;
		readonly parentUnitId: string;
		readonly projectionVersion: number;
	}>(
		`select projection_version as "projectionVersion", ordinal,
			parent_unit_id as "parentUnitId", child_unit_id as "childUnitId"
		from public.current_unit_structure_edge
		where structure_id = $1 order by ordinal`,
		[PathOneId],
	);
	assert(
		edges.rows.length === expectedMembers.length - 1 &&
			edges.rows.every(
				(row, ordinal) =>
					row.projectionVersion === expectedProjectionVersion &&
					row.ordinal === ordinal &&
					row.parentUnitId === expectedMembers[ordinal] &&
					row.childUnitId === expectedMembers[ordinal + 1],
			),
		`Current Structure edges are not the exact projection ${expectedProjectionVersion}`,
	);

	const end = await queryOne<{
		readonly finalTagId: string;
		readonly projectionVersion: number;
	}>(
		client,
		`select projection_version as "projectionVersion", final_tag_id as "finalTagId"
		from public.current_unit_structure_end where structure_id = $1`,
		[PathOneId],
	);
	assert(
		end.projectionVersion === expectedProjectionVersion && end.finalTagId === expectedLeafTagId,
		`Current Structure end is not the exact projection ${expectedProjectionVersion}`,
	);

	const candidate = await queryOne<{
		readonly accepted: boolean;
		readonly finalTagId: string;
		readonly projectionVersion: number;
		readonly score: string;
		readonly voteCount: string;
	}>(
		client,
		`select projection_version as "projectionVersion", final_tag_id as "finalTagId",
			accepted, score::text as score, vote_count::text as "voteCount"
		from public.current_unit_structure_primary_path_candidate
		where structure_id = $1`,
		[PathOneId],
	);
	assert(
		candidate.projectionVersion === expectedProjectionVersion &&
			candidate.finalTagId === expectedLeafTagId &&
			candidate.accepted &&
			candidate.score === "1" &&
			candidate.voteCount === "1",
		`Current primary-Path candidate is not the exact projection ${expectedProjectionVersion}`,
	);

	const primaryRows = await client.query<{
		readonly structureId: string;
		readonly structureProjectionVersion: number;
		readonly tagId: string;
	}>(
		`select tag_id as "tagId", structure_id as "structureId",
			structure_projection_version as "structureProjectionVersion"
		from public.current_tag_primary_display_path
		where tag_id = any($1::uuid[]) order by tag_id`,
		[[TagCId, TagEId]],
	);
	assert(
		primaryRows.rows.length === 1 &&
			primaryRows.rows[0]?.tagId === expectedLeafTagId &&
			primaryRows.rows[0]?.structureId === PathOneId &&
			primaryRows.rows[0]?.structureProjectionVersion === expectedProjectionVersion,
		`Primary display pointer is not atomic for projection ${expectedProjectionVersion}`,
	);
}

async function assertCurrentCorrectionDerived(
	client: Client,
	expectedProjectionVersion: number,
	expectedSupportTagIds: readonly string[],
): Promise<void> {
	const expectedSupports = [...expectedSupportTagIds].toSorted();
	const supportRows = await client.query<{
		readonly projectionVersion: number;
		readonly tagId: string;
	}>(
		`select tag_id as "tagId", projection_version as "projectionVersion"
		from public.current_unit_tag_structure_support
		where unit_id = $1 and structure_id = $2 and profile_id = $3
		order by tag_id`,
		[TargetUnitId, PathOneId, ProfileIds[0]],
	);
	assert(
		supportRows.rows.map(({ tagId }) => tagId).join(",") === expectedSupports.join(",") &&
			supportRows.rows.every(
				({ projectionVersion }) => projectionVersion === expectedProjectionVersion,
			),
		`Current Structure support is not the exact projection ${expectedProjectionVersion}`,
	);

	const directlyApplied = [TagAId, TagBId, TagCId] as const;
	const supportSet = new Set(expectedSupports);
	const expectedContexts = [...new Set([...directlyApplied, ...expectedSupports])]
		.toSorted()
		.map(
			(tagId) =>
				`${tagId}:${directlyApplied.includes(tagId as (typeof directlyApplied)[number])}:${
					supportSet.has(tagId) ? 1 : 0
				}`,
		);
	const contexts = await client.query<{
		readonly direct: boolean;
		readonly structureSupportCount: string;
		readonly tagId: string;
	}>(
		`select tag_id as "tagId", direct,
			structure_support_count::text as "structureSupportCount"
		from public.current_unit_effective_tag
		where unit_id = $1 and tag_id = any($2::uuid[]) order by tag_id`,
		[TargetUnitId, [TagAId, TagBId, TagCId, TagDId, TagEId]],
	);
	assert(
		contexts.rows
			.map(
				({ tagId, direct, structureSupportCount }) => `${tagId}:${direct}:${structureSupportCount}`,
			)
			.join(",") === expectedContexts.join(","),
		`Current effective contexts are not the exact projection ${expectedProjectionVersion}`,
	);

	const expectedVoteTagIds = [...new Set([TagAId, ...expectedSupports])].toSorted();
	const votes = await client.query<{ readonly tagId: string; readonly value: number }>(
		`select tag_id as "tagId", value
		from public.current_unit_effective_tag_vote
		where unit_id = $1 and profile_id = $2 and tag_id = any($3::uuid[])
		order by tag_id`,
		[TargetUnitId, ProfileIds[0], [TagAId, TagBId, TagCId, TagDId, TagEId]],
	);
	assert(
		votes.rows.map(({ tagId }) => tagId).join(",") === expectedVoteTagIds.join(",") &&
			votes.rows.every(({ value }) => value === 1),
		`Current effective votes are not the exact projection ${expectedProjectionVersion}`,
	);

	const stats = await client.query<{
		readonly score: string;
		readonly tagId: string;
		readonly voteCount: string;
	}>(
		`select tag_id as "tagId", score::text as score, vote_count::text as "voteCount"
		from public.current_unit_tag_judgment_stat
		where unit_id = $1 and tag_id = any($2::uuid[]) order by tag_id`,
		[TargetUnitId, [TagAId, TagBId, TagCId, TagDId, TagEId]],
	);
	assert(
		stats.rows.map(({ tagId }) => tagId).join(",") === expectedVoteTagIds.join(",") &&
			stats.rows.every(({ score, voteCount }) => score === "1" && voteCount === "1"),
		`Current Tag aggregates are not the exact projection ${expectedProjectionVersion}`,
	);
}

async function assertCorrectionSourceFacts(client: Client): Promise<void> {
	const source = await queryOne<{
		readonly applicationFit: number | null;
		readonly applicationJudgments: string;
		readonly applicationRows: string;
		readonly applicationScore: string | null;
		readonly applicationStats: string;
		readonly applicationVoteCount: string | null;
		readonly definitionValue: number | null;
		readonly definitionVotes: string;
		readonly structureRows: string;
	}>(
		client,
		`select
			(select count(*)::text from public.unit_structure where id = $1) as "structureRows",
			(select count(*)::text from public.unit_structure_vote
			 where structure_id = $1 and profile_id = $2) as "definitionVotes",
			(select value from public.unit_structure_vote
			 where structure_id = $1 and profile_id = $2) as "definitionValue",
			(select count(*)::text from public.unit_structure_application
			 where unit_id = $3 and structure_id = $1) as "applicationRows",
			(select count(*)::text from public.unit_structure_application_judgment
			 where unit_id = $3 and structure_id = $1 and profile_id = $2)
				as "applicationJudgments",
			(select fit_vote from public.unit_structure_application_judgment
			 where unit_id = $3 and structure_id = $1 and profile_id = $2) as "applicationFit",
			(select count(*)::text from public.unit_structure_application_judgment_stat
			 where unit_id = $3 and structure_id = $1) as "applicationStats",
			(select score::text from public.unit_structure_application_judgment_stat
			 where unit_id = $3 and structure_id = $1) as "applicationScore",
			(select vote_count::text from public.unit_structure_application_judgment_stat
			 where unit_id = $3 and structure_id = $1) as "applicationVoteCount"`,
		[PathOneId, ProfileIds[0], TargetUnitId],
	);
	assert(
		source.structureRows === "1" &&
			source.definitionVotes === "1" &&
			source.definitionValue === 1 &&
			source.applicationRows === "1" &&
			source.applicationJudgments === "1" &&
			source.applicationFit === 1 &&
			source.applicationStats === "1" &&
			source.applicationScore === "1" &&
			source.applicationVoteCount === "1",
		`Structure identity, votes, or applications changed; received ${JSON.stringify(source)}`,
	);
}

async function assertCorrectionEvidence(client: Client, expectedCount: string): Promise<void> {
	const evidence = await queryOne<{ readonly audits: string; readonly revisions: string }>(
		client,
		`select
			(select count(*)::text from public.unit_revision
			 where unit_id = $1 and actor_profile_id = $2) as revisions,
			(select count(*)::text from public.audit_event
			 where actor_profile_id = $2 and authority_kind = 'unit' and authority_id = $1)
				as audits`,
		[PathOneId, ProfileIds[0]],
	);
	assert(
		evidence.revisions === expectedCount && evidence.audits === expectedCount,
		`Correction evidence count must be ${expectedCount}; received ${JSON.stringify(evidence)}`,
	);
}

async function dispatchCorrectionStep(
	runtime: CorrectionRuntime,
	correctionId: string,
	statuses: CorrectionStatus[],
): Promise<UnitStructureCorrectionJob> {
	const claimed = await runtime.dispatch({
		maxJobs: 1,
		batchSize: 10_000,
		leaseOwner: "rezics-vndb-v11-correction-fixture",
	});
	const job = await runtime.get(PathOneId, correctionId);
	assert(
		claimed === 1,
		`Correction worker did not claim its one ready job at ${job.status}; ${job.lastErrorCode ?? "no error"}: ${job.lastErrorMessage ?? "no message"}`,
	);
	rememberCorrectionStatus(statuses, job.status);
	assert(
		job.status !== "failed" && job.status !== "cancelled",
		`Correction entered terminal ${job.status}; ${job.lastErrorCode ?? "no error"}: ${job.lastErrorMessage ?? "no message"}`,
	);
	return job;
}

async function dispatchCorrectionUntil(
	runtime: CorrectionRuntime,
	correctionId: string,
	initial: UnitStructureCorrectionJob,
	targetStatus: CorrectionStatus,
	statuses: CorrectionStatus[],
): Promise<UnitStructureCorrectionJob> {
	let job = initial;
	for (let step = 0; step < MaximumCorrectionDispatchSteps && job.status !== targetStatus; step++)
		job = await dispatchCorrectionStep(runtime, correctionId, statuses);
	assert(
		job.status === targetStatus,
		`Correction did not reach ${targetStatus} within ${MaximumCorrectionDispatchSteps} bounded steps`,
	);
	return job;
}

async function waitForBlockedCorrectionWorker(client: Client, blockerPid: number): Promise<void> {
	for (let attempt = 0; attempt < 300; attempt++) {
		const state = await queryOne<{ readonly blocked: boolean }>(
			client,
			`select exists (
				select 1 from pg_catalog.pg_stat_activity as activity
				where activity.pid <> pg_backend_pid()
					and $1::integer = any(pg_catalog.pg_blocking_pids(activity.pid))
			) as blocked`,
			[blockerPid],
		);
		if (state.blocked) return;
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("Correction activation did not block on the held Structure row");
}

async function assertCompletedCorrectionCleanup(
	client: Client,
	correctionId: string,
): Promise<void> {
	const cleanup = await queryOne<{
		readonly activation: string;
		readonly effectiveVotes: string;
		readonly incompleteShards: string;
		readonly primaryPaths: string;
		readonly tagProjections: string;
		readonly tagReservations: string;
		readonly unitReservations: string;
	}>(
		client,
		`select
			(select count(*)::text from public.unit_structure_correction_activation
			 where job_id = $1) as activation,
			(select count(*)::text from public.unit_structure_correction_tag_reservation
			 where job_id = $1) as "tagReservations",
			(select count(*)::text from public.unit_structure_correction_unit_reservation
			 where job_id = $1) as "unitReservations",
			(select count(*)::text from public.unit_structure_correction_effective_vote
			 where job_id = $1) as "effectiveVotes",
			(select count(*)::text from public.unit_structure_correction_tag_projection
			 where job_id = $1) as "tagProjections",
			(select count(*)::text from public.unit_structure_correction_primary_path
			 where job_id = $1) as "primaryPaths",
			(select count(*)::text from public.unit_structure_correction_shard
			 where job_id = $1 and completed_at is null) as "incompleteShards"`,
		[correctionId],
	);
	assert(
		Object.values(cleanup).every((count) => count === "0"),
		`Completed correction retained live reservations or staging rows; received ${JSON.stringify(cleanup)}`,
	);
}

async function verifyDurablePathCorrection(
	fixtureClient: Client,
	connectionString: string,
): Promise<void> {
	const blockerClient = new Client({
		connectionString,
		application_name: "rezics-vndb-v11-correction-activation-blocker",
	});
	const racingClient = new Client({
		connectionString,
		application_name: "rezics-vndb-v11-correction-direct-racer",
	});
	const originalDatabaseUrl = process.env.DATABASE_URL;
	let blockerConnected = false;
	let blockerTransactionOpen = false;
	let closeDatabasePool: (() => Promise<void>) | undefined;
	let fixtureCommitted = false;
	let racingConnected = false;
	let racingTransactionOpen = false;
	try {
		await seedCorrectionFixture(fixtureClient);
		fixtureCommitted = true;
		await assertCorrectionControlsReady(fixtureClient);
		await assertCurrentCorrectionPath(fixtureClient, 1, [TagAId, TagBId, TagCId], TagCId);
		await assertCurrentCorrectionDerived(fixtureClient, 1, [TagAId, TagBId, TagCId]);
		await assertCorrectionSourceFacts(fixtureClient);
		await assertCorrectionEvidence(fixtureClient, "0");

		process.env.DATABASE_URL = connectionString;
		const [{ PlatformAuthorization }, correction, worker, { database }] = await Promise.all([
			import("../src/services/authorization/platform/authorization"),
			import("../src/services/tag-structures/correction"),
			import("../src/services/tag-structures/correction-worker"),
			import("../src/services/database"),
		]);
		closeDatabasePool = () => database.$client.end();
		const runtime: CorrectionRuntime = {
			dispatch: worker.dispatchUnitStructureCorrectionJobs,
			get: correction.getUnitStructureCorrection,
		};
		const authorization = new PlatformAuthorization(ProfileIds[0]);
		const structure = await queryOne<{ readonly updatedAt: Date }>(
			fixtureClient,
			`select updated_at as "updatedAt" from public.unit_structure where id = $1`,
			[PathOneId],
		);
		const commonInput = {
			structureId: PathOneId,
			expectedUpdatedAt: structure.updatedAt,
			reason: "Correct the disposable VNDB v11 Path projection",
			actorProfileId: ProfileIds[0],
			authorization,
			contribution: { primary: "human" as const },
		};
		const noChange = await correction.submitUnitStructureCorrection({
			...commonInput,
			memberTagIds: [TagAId, TagBId, TagCId],
		});
		assert(
			!noChange.changed &&
				noChange.correctionId === null &&
				noChange.status === "completed" &&
				noChange.sourceProjectionVersion === 1 &&
				noChange.targetProjectionVersion === 1,
			"An identical correction submission must be a synchronous no-op",
		);
		const noChangeJobs = await queryOne<{ readonly count: string }>(
			fixtureClient,
			"select count(*)::text as count from public.unit_structure_correction where structure_id = $1",
			[PathOneId],
		);
		assert(noChangeJobs.count === "0", "An identical correction submission persisted a job");

		const correctionInput = {
			...commonInput,
			memberTagIds: [TagDId, TagBId, TagEId],
		};
		const submitted = await correction.submitUnitStructureCorrection(correctionInput);
		assert(submitted.changed, "A semantic correction submission must persist a job");
		const correctionId = submitted.correctionId;
		assert(
			submitted.status === "pending" &&
				submitted.writeRoute === "source" &&
				submitted.sourceProjectionVersion === 1 &&
				submitted.targetProjectionVersion === 2,
			"A semantic correction must return its pending v1-to-v2 job",
		);
		const repeated = await correction.submitUnitStructureCorrection(correctionInput);
		assert(
			repeated.changed && repeated.correctionId === correctionId && repeated.status === "pending",
			"Retrying the same open correction must return the existing durable job",
		);
		let job = await runtime.get(PathOneId, correctionId);
		const statuses: CorrectionStatus[] = [];
		rememberCorrectionStatus(statuses, job.status);
		job = await dispatchCorrectionUntil(runtime, correctionId, job, "ready", statuses);
		assert(job.writeRoute === "source", "A ready correction must still expose the source route");
		await assertCurrentCorrectionPath(fixtureClient, 1, [TagAId, TagBId, TagCId], TagCId);
		await assertCurrentCorrectionDerived(fixtureClient, 1, [TagAId, TagBId, TagCId]);
		await assertCorrectionSourceFacts(fixtureClient);
		await assertCorrectionEvidence(fixtureClient, "0");

		await racingClient.connect();
		racingConnected = true;
		await racingClient.query("begin");
		racingTransactionOpen = true;
		await racingClient.query("set local statement_timeout = '2s'");
		await expectDatabaseError(
			racingClient,
			() =>
				racingClient.query(
					`update public.unit_tag_judgment
					set fit_vote = -1, fit_updated_at = $1, updated_at = $1
					where unit_id = $2 and tag_id = $3 and profile_id = $4`,
					["2026-08-23T14:00:30.000Z", TargetUnitId, TagAId, ProfileIds[0]],
				),
			{ code: "55P03", constraint: "unit_structure_correction_frozen" },
			"A reserved direct judgment must fail fast while correction staging is ready",
		);
		const frozenDirect = await queryOne<{ readonly fitVote: number | null }>(
			racingClient,
			`select fit_vote as "fitVote" from public.unit_tag_judgment
			where unit_id = $1 and tag_id = $2 and profile_id = $3`,
			[TargetUnitId, TagAId, ProfileIds[0]],
		);
		assert(frozenDirect.fitVote === 1, "A rejected reserved write changed its direct source row");
		await racingClient.query("rollback");
		racingTransactionOpen = false;
		await assertCurrentCorrectionPath(fixtureClient, 1, [TagAId, TagBId, TagCId], TagCId);
		await assertCurrentCorrectionDerived(fixtureClient, 1, [TagAId, TagBId, TagCId]);

		job = await dispatchCorrectionStep(runtime, correctionId, statuses);
		assert(job.status === "activating", "The ready boundary must advance to activating first");
		await assertCorrectionEvidence(fixtureClient, "0");
		await assertCurrentCorrectionPath(fixtureClient, 1, [TagAId, TagBId, TagCId], TagCId);

		await blockerClient.connect();
		blockerConnected = true;
		await blockerClient.query("begin");
		blockerTransactionOpen = true;
		const blocker = await queryOne<{ readonly pid: number }>(
			blockerClient,
			`select pg_backend_pid() as pid from public.unit_structure
			where id = $1 for update`,
			[PathOneId],
		);
		const activationDispatch = runtime.dispatch({
			maxJobs: 1,
			batchSize: 10_000,
			leaseOwner: "rezics-vndb-v11-correction-activation",
		});
		void activationDispatch.catch(() => undefined);
		await waitForBlockedCorrectionWorker(fixtureClient, blocker.pid);
		await assertCurrentCorrectionPath(fixtureClient, 1, [TagAId, TagBId, TagCId], TagCId);
		await assertCurrentCorrectionDerived(fixtureClient, 1, [TagAId, TagBId, TagCId]);
		await assertCorrectionEvidence(fixtureClient, "0");
		await blockerClient.query("commit");
		blockerTransactionOpen = false;
		assert((await activationDispatch) === 1, "Activation dispatch did not retain its claimed job");
		job = await runtime.get(PathOneId, correctionId);
		rememberCorrectionStatus(statuses, job.status);
		assert(
			job.status === "active_overlay" && job.writeRoute === "overlay",
			"Activation must atomically publish the overlay route",
		);
		await assertCurrentCorrectionPath(fixtureClient, 2, [TagDId, TagBId, TagEId], TagEId);
		await assertCurrentCorrectionDerived(fixtureClient, 2, [TagDId, TagBId, TagEId]);
		await assertCorrectionSourceFacts(fixtureClient);
		await assertCorrectionEvidence(fixtureClient, "1");

		job = await dispatchCorrectionUntil(runtime, correctionId, job, "completed", statuses);
		assert(
			job.writeRoute === "target" && job.activatedAt !== null && job.completedAt !== null,
			"A completed correction must expose the target route and completion timestamps",
		);
		assert(
			statuses.join(",") === CorrectionStatusSequence.join(","),
			`Correction skipped or reordered a durable status; observed ${statuses.join(",")}`,
		);
		await assertCurrentCorrectionPath(fixtureClient, 2, [TagDId, TagBId, TagEId], TagEId);
		await assertCurrentCorrectionDerived(fixtureClient, 2, [TagDId, TagBId, TagEId]);
		await assertCorrectionSourceFacts(fixtureClient);
		await assertCorrectionEvidence(fixtureClient, "1");
		await assertCompletedCorrectionCleanup(fixtureClient, correctionId);

		await racingClient.query("begin");
		racingTransactionOpen = true;
		const retry = await racingClient.query(
			`update public.unit_tag_judgment
			set fit_vote = -1, fit_updated_at = $1, updated_at = $1
			where unit_id = $2 and tag_id = $3 and profile_id = $4`,
			["2026-08-23T14:00:30.000Z", TargetUnitId, TagAId, ProfileIds[0]],
		);
		assert(retry.rowCount === 1, "The reserved direct judgment retry did not update one row");
		await racingClient.query("commit");
		racingTransactionOpen = false;
		assertAggregate(
			await readUnitTagAggregate(fixtureClient, TagAId),
			{ score: -1, voteCount: 1, spoilerCount: 1, none: 0, minor: 1, major: 0 },
			"The direct retry after correction completion did not converge exactly",
		);
		await assertCorrectionSourceFacts(fixtureClient);
		const finalJob = await runtime.get(PathOneId, correctionId);
		assert(
			finalJob.status === "completed" && finalJob.correctionId === correctionId,
			"The scoped correction status endpoint did not retain the completed job",
		);
	} finally {
		if (blockerTransactionOpen) await blockerClient.query("rollback").catch(() => undefined);
		if (racingTransactionOpen) await racingClient.query("rollback").catch(() => undefined);
		await Promise.allSettled([
			...(blockerConnected ? [blockerClient.end()] : []),
			...(racingConnected ? [racingClient.end()] : []),
		]);
		try {
			if (closeDatabasePool) await closeDatabasePool();
		} finally {
			try {
				if (fixtureCommitted) await cleanupCommittedFixture(fixtureClient);
			} finally {
				if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
				else process.env.DATABASE_URL = originalDatabaseUrl;
			}
		}
	}
}

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const client = new Client({
	connectionString,
	application_name: "rezics-vndb-v11-contract-check",
});

await client.connect();
let transactionOpen = false;
try {
	await assertDisposableDatabase(client, connectionString);
	await assertFixtureAbsent(client);
	await client.query("begin");
	transactionOpen = true;
	try {
		await seedOwnersAndUnits(client);
		await seedRelationships(client);
		await verifyPathDefinitions(client);
		await verifyDirectJudgments(client);
		await verifyPathJudgmentsAndConflicts(client);
		await verifyRealmJudgments(client);
		await verifySparseJudgmentConstraints(client);
		await verifyRealmNoOpStatMaintenance(client);
		await verifyRealmCascadeAndCorruptionGuards(client);
		await verifySubjectJudgments(client);
		await verifyNonRealmNoOpStatMaintenance(client);
		await verifyNonRealmCorruptionGuards(client);
		await verifyNonRealmParentCascades(client);
		await verifyAggregateCheckConstraints(client);
		await verifyContentLabelAndTagPolicyGuards(client);
		await verifyMeasurements(client);
		await verifyIdempotentJudgmentUpserts(client);
		await verifySourceAggregateParity(client);
	} finally {
		await client.query("rollback");
		transactionOpen = false;
	}
	await assertFixtureAbsent(client);
	await verifyConcurrentHotKeyLocking(client, connectionString);
	await assertFixtureAbsent(client);
	await verifyDurablePathCorrection(client, connectionString);
	await assertFixtureAbsent(client);
	console.info("VNDB v11 disposable database contract invariants verified and cleaned.");
} finally {
	if (transactionOpen) await client.query("rollback");
	await client.end();
}
