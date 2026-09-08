import { Client } from "pg";

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

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
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

async function verifyIdentitySchema(client: Client): Promise<void> {
	const column = await issuerColumn(client);
	assert(column?.notNull, "accounts.issuer must be NOT NULL");
	assert(
		column.defaultExpression?.includes(CredentialIssuer),
		"accounts.issuer must retain the default issuer for password credentials",
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

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const client = new Client({ connectionString });
try {
 await client.connect();
 await verifyIdentitySchema(client);
} finally {
 await client.end();
}
