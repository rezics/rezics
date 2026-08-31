import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const FixtureUserId = "76000000-0000-7000-8000-000000000001";
const FixtureAccountId = "76100000-0000-7000-8000-000000000001";
const RejectedFixtureAccountId = "76100000-0000-7000-8000-000000000002";
const FixtureEmail = "better-auth-identity-cutover@example.invalid";
const CredentialProviderId = "credential";
const CredentialIssuer = "local:credential";

interface IndexState {
	readonly definition: string;
	readonly ready: boolean;
	readonly unique: boolean;
	readonly valid: boolean;
}

interface ColumnState {
	readonly defaultExpression: string | null;
	readonly notNull: boolean;
}

interface UnexpectedProvider {
	readonly accountId: string;
	readonly providerId: string;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this command writes disposable fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"Better Auth identity fixtures may run only in the disposable rezics_atlas database",
	);
}

async function accountsRelationExists(client: Client): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		"select to_regclass('public.accounts') is not null as exists",
	);
	return result.rows[0]?.exists === true;
}

async function issuerColumn(client: Client): Promise<ColumnState | undefined> {
	if (!(await accountsRelationExists(client))) return undefined;
	const result = await client.query<ColumnState>(
		`select
			a.attnotnull as "notNull",
			pg_get_expr(d.adbin, d.adrelid) as "defaultExpression"
		from pg_catalog.pg_attribute as a
		left join pg_catalog.pg_attrdef as d
			on d.adrelid = a.attrelid and d.adnum = a.attnum
		where a.attrelid = to_regclass('public.accounts')
			and a.attname = 'issuer'
			and not a.attisdropped`,
	);
	return result.rows[0];
}

async function indexState(client: Client, name: string): Promise<IndexState | undefined> {
	const result = await client.query<IndexState>(
		`select
			i.indisready as ready,
			i.indisunique as unique,
			i.indisvalid as valid,
			pg_get_indexdef(i.indexrelid) as definition
		from pg_catalog.pg_index as i
		join pg_catalog.pg_class as c on c.oid = i.indexrelid
		join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relname = $1`,
		[name],
	);
	return result.rows[0];
}

async function findUnexpectedProviders(client: Client): Promise<readonly UnexpectedProvider[]> {
	const result = await client.query<UnexpectedProvider>(
		`(
			select provider_id as "providerId", account_id as "accountId"
			from public.accounts
			where provider_id < $1
			order by provider_id, account_id
			limit 50
		)
		union all
		(
			select provider_id as "providerId", account_id as "accountId"
			from public.accounts
			where provider_id > $1
			order by provider_id, account_id
			limit 50
		)
		limit 50`,
		[CredentialProviderId],
	);
	return result.rows;
}

async function verifyPreCutoverPlan(client: Client): Promise<void> {
	const oldIndex = await indexState(client, "accounts_provider_id_account_id_key");
	assert(oldIndex?.unique, "The pre-1.7 account identity index must be unique");
	assert(
		oldIndex.ready && oldIndex.valid,
		"The pre-1.7 account identity index must be ready and valid",
	);

	const unexpectedProviders = await findUnexpectedProviders(client);
	assert(
		unexpectedProviders.length === 0,
		`Better Auth 1.7 cutover supports existing credential accounts only; found ${JSON.stringify(unexpectedProviders)}`,
	);

	await client.query("set local enable_seqscan = off");
	const plan = await client.query(
		`explain (format json)
		select provider_id, account_id
		from public.accounts
		where provider_id > $1
		order by provider_id, account_id
		limit 50`,
		[CredentialProviderId],
	);
	assert(
		JSON.stringify(plan.rows).includes("accounts_provider_id_account_id_key"),
		"The provider inventory must remain eligible for the existing bounded identity index",
	);
}

async function runPreflight(client: Client): Promise<void> {
	if (!(await accountsRelationExists(client))) {
		console.info(
			"Better Auth 1.7 account identity cutover preflight passed (empty public schema).",
		);
		return;
	}
	await client.query("begin read only");
	try {
		await client.query("set local statement_timeout = '30s'");
		const column = await issuerColumn(client);
		if (!column) await verifyPreCutoverPlan(client);
		else {
			const newIndex = await indexState(client, "accounts_issuer_account_id_key");
			assert(
				!newIndex || (newIndex.ready && newIndex.valid),
				"The prior concurrent issuer index attempt is invalid; drop that index concurrently before retrying",
			);
		}
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Better Auth 1.7 account identity cutover preflight passed.");
}

async function seedFixture(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	await client.query("begin");
	try {
		await client.query(
			`insert into public.users (
				id, name, email, email_verified, registration_content_language, created_at, updated_at
			) values ($1, 'Better Auth identity cutover fixture', $2, true, 'en', now(), now())
			on conflict (id) do nothing`,
			[FixtureUserId, FixtureEmail],
		);
		await client.query(
			`insert into public.accounts (
				id, account_id, provider_id, user_id, created_at, updated_at
			) values ($1, 'rejected-fixture', 'oauth-fixture', $2, now(), now())`,
			[RejectedFixtureAccountId, FixtureUserId],
		);
		const findings = await findUnexpectedProviders(client);
		assert(
			findings.some(
				({ accountId, providerId }) =>
					accountId === "rejected-fixture" && providerId === "oauth-fixture",
			),
			"The preflight inventory must reject a non-credential legacy account",
		);
		await client.query("delete from public.accounts where id = $1", [RejectedFixtureAccountId]);
		await client.query(
			`insert into public.accounts (
				id, account_id, provider_id, user_id, password, created_at, updated_at
			) values ($1, $2, $3, $4, 'fixture-password-hash', now(), now())
			on conflict (id) do nothing`,
			[FixtureAccountId, FixtureUserId, CredentialProviderId, FixtureUserId],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Seeded the Better Auth 1.7 account identity cutover fixture.");
}

async function verifyMigratedSchema(client: Client): Promise<void> {
	const column = await issuerColumn(client);
	assert(column?.notNull, "accounts.issuer must be NOT NULL");
	assert(
		column.defaultExpression?.includes(CredentialIssuer),
		"accounts.issuer must retain the credential rollback default",
	);

	for (const name of [
		"accounts_provider_id_account_id_key",
		"accounts_issuer_account_id_key",
	] as const) {
		const index = await indexState(client, name);
		assert(index?.unique, `${name} must be unique`);
		assert(index.ready && index.valid, `${name} must be ready and valid`);
		const expectedColumns =
			name === "accounts_provider_id_account_id_key"
				? "(provider_id, account_id)"
				: "(issuer, account_id)";
		assert(index.definition.endsWith(expectedColumns), `${name} must cover ${expectedColumns}`);
	}

	const apiKeyDefault = await client.query<{ readonly expression: string | null }>(
		`select pg_get_expr(d.adbin, d.adrelid) as expression
		from pg_catalog.pg_attribute as a
		left join pg_catalog.pg_attrdef as d
			on d.adrelid = a.attrelid and d.adnum = a.attnum
		where a.attrelid = 'public.apikeys'::regclass
			and a.attname = 'rate_limit_max'
			and not a.attisdropped`,
	);
	assert(apiKeyDefault.rows[0]?.expression === "5000", "API key rate-limit default must be 5000");
	console.info("Better Auth 1.7 account identity schema verified.");
}

async function verifyAndCleanFixture(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	await verifyMigratedSchema(client);

	const account = await client.query<{ readonly issuer: string }>(
		"select issuer from public.accounts where id = $1",
		[FixtureAccountId],
	);
	assert(
		account.rows[0]?.issuer === CredentialIssuer,
		"The legacy credential fixture must receive the Better Auth 1.7 issuer",
	);

	await client.query("begin");
	try {
		await client.query("delete from public.accounts where id = any($1::uuid[])", [
			[FixtureAccountId, RejectedFixtureAccountId],
		]);
		await client.query("delete from public.users where id = $1", [FixtureUserId]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Better Auth 1.7 account identity migration verified.");
}

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const mode = process.argv[2] ?? "preflight";
assert(
	mode === "preflight" || mode === "seed" || mode === "verify" || mode === "verify-and-clean",
	"Usage: check-better-auth-identity-cutover.ts [preflight|seed|verify|verify-and-clean]",
);

const client = new Client({ connectionString });
try {
	await client.connect();
	if (mode === "preflight") await runPreflight(client);
	else if (mode === "seed") await seedFixture(client);
	else if (mode === "verify") await verifyMigratedSchema(client);
	else await verifyAndCleanFixture(client);
} finally {
	await client.end();
}
