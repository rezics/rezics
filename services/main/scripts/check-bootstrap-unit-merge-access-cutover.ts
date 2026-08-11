import { Client } from "pg";

import { BootstrapPlatformAdministratorProfile } from "../src/services/bootstrap/manifest";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const ReviewExpiringGrantId = "72000000-0000-7000-8000-000000000001";
const DirectPermanentGrantId = "72000000-0000-7000-8000-000000000002";
const Timestamp = "2026-08-11T10:00:00.000Z";
const FutureExpiry = "2099-01-01T00:00:00.000Z";
const MergeCapabilities = ["unit.merge.propose", "unit.merge.review", "unit.merge"] as const;

type MergeCapability = (typeof MergeCapabilities)[number];

interface GrantRow {
	readonly id: string;
	readonly capability: string;
	readonly expiresAt: Date | null;
	readonly revokedAt: Date | null;
}

interface AuditRow {
	readonly details: unknown;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMergeCapability(value: unknown): value is MergeCapability {
	return typeof value === "string" && MergeCapabilities.some((capability) => capability === value);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes destructive fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"Bootstrap access cutover fixtures may run only in the disposable rezics_atlas database",
	);
}

async function seed(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	const existing = await client.query<{ readonly exists: boolean }>(
		"select exists (select 1 from public.profile where id = $1::uuid) as exists",
		[BootstrapPlatformAdministratorProfile.profileId],
	);
	assert(existing.rows[0]?.exists === false, "Bootstrap access cutover fixture already exists");

	await client.query("begin");
	try {
		await client.query(
			`insert into public.users (
				id, name, email, email_verified, registration_content_language, created_at, updated_at
			) values ($1, $2, $3, true, 'en', $4, $4)`,
			[
				BootstrapPlatformAdministratorProfile.authUserId,
				BootstrapPlatformAdministratorProfile.name,
				BootstrapPlatformAdministratorProfile.email,
				Timestamp,
			],
		);
		await client.query(
			`insert into public.unit (id, kind, created_at, updated_at)
			values ($1, 'profile', $2, $2)`,
			[BootstrapPlatformAdministratorProfile.profileId, Timestamp],
		);
		await client.query(
			`insert into public.profile (id, auth_user_id, joined_at, created_at, updated_at)
			values ($1, $2, $3, $3, $3)`,
			[
				BootstrapPlatformAdministratorProfile.profileId,
				BootstrapPlatformAdministratorProfile.authUserId,
				Timestamp,
			],
		);
		await client.query(
			`insert into public.platform_capability_grant (
				id,
				profile_id,
				capability,
				granted_by_profile_id,
				expires_at,
				created_at,
				updated_at
			) values
				($1, $3, 'unit.merge.review', $3, $4, $5, $5),
				($2, $3, 'unit.merge', $3, null, $5, $5)`,
			[
				ReviewExpiringGrantId,
				DirectPermanentGrantId,
				BootstrapPlatformAdministratorProfile.profileId,
				FutureExpiry,
				Timestamp,
			],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function verifyAndClean(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	const grants = await client.query<GrantRow>(
		`select
			id,
			capability::text as capability,
			expires_at as "expiresAt",
			revoked_at as "revokedAt"
		from public.platform_capability_grant
		where profile_id = $1
			and capability = any($2::public.platform_capability[])
		order by capability, created_at, id`,
		[BootstrapPlatformAdministratorProfile.profileId, MergeCapabilities],
	);
	for (const grant of grants.rows)
		assert(isMergeCapability(grant.capability), "Expected only Unit-merge capability grants");

	for (const capability of MergeCapabilities) {
		const active = grants.rows.filter(
			(grant) => grant.capability === capability && grant.revokedAt === null,
		);
		assert(active.length === 1, `Expected one active ${capability} bootstrap grant`);
		assert(active[0]?.expiresAt === null, `Expected permanent ${capability} bootstrap access`);
	}

	const replacedReview = grants.rows.find((grant) => grant.id === ReviewExpiringGrantId);
	assert(
		replacedReview?.revokedAt instanceof Date,
		"Expected the expiring review grant to be replaced",
	);
	const retainedDirect = grants.rows.find((grant) => grant.id === DirectPermanentGrantId);
	assert(
		retainedDirect?.revokedAt === null && retainedDirect.expiresAt === null,
		"Expected the permanent direct-merge grant to be retained",
	);

	const auditEvents = await client.query<AuditRow>(
		`select details
		from public.audit_event
		where actor_profile_id = $1
			and action = 'platform.access.bootstrap'
			and details->>'source' = 'migration'`,
		[BootstrapPlatformAdministratorProfile.profileId],
	);
	const auditedCapabilities = new Set<MergeCapability>();
	for (const event of auditEvents.rows) {
		assert(isRecord(event.details), "Expected bootstrap access audit details to be an object");
		const capability = event.details.capability;
		assert(isMergeCapability(capability), "Expected a Unit-merge capability in audit details");
		auditedCapabilities.add(capability);
	}
	assert(
		auditEvents.rows.length === 2 &&
			auditedCapabilities.has("unit.merge.propose") &&
			auditedCapabilities.has("unit.merge.review"),
		"Expected audited creation and replacement without duplicating permanent access",
	);

	await client.query("begin");
	try {
		await client.query("alter table public.audit_event disable trigger audit_event_append_only");
		await client.query(
			`delete from public.audit_event
			where actor_profile_id = $1 and action = 'platform.access.bootstrap'`,
			[BootstrapPlatformAdministratorProfile.profileId],
		);
		await client.query("alter table public.audit_event enable trigger audit_event_append_only");
		await client.query("delete from public.platform_capability_grant where profile_id = $1", [
			BootstrapPlatformAdministratorProfile.profileId,
		]);
		await client.query("delete from public.profile where id = $1", [
			BootstrapPlatformAdministratorProfile.profileId,
		]);
		await client.query("delete from public.unit where id = $1", [
			BootstrapPlatformAdministratorProfile.profileId,
		]);
		await client.query("delete from public.users where id = $1", [
			BootstrapPlatformAdministratorProfile.authUserId,
		]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

const mode = process.argv[2];
assert(mode === "seed" || mode === "verify-and-clean", "Expected seed or verify-and-clean mode");
const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const client = new Client({ connectionString });

try {
	await client.connect();
	if (mode === "seed") await seed(client);
	else await verifyAndClean(client);
	console.info(`Bootstrap Unit-merge access cutover ${mode} completed.`);
} finally {
	await client.end();
}
