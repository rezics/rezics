import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const MigrationOverlayLockKey = 71_011;
const RequiredDatabaseName = "rezics_atlas";

export type MigrationOverlayTransactionMode = "file" | "none";

interface OverlayQueryClient {
	query(query: string): Promise<unknown>;
}

/** @internal */
export function splitSqlStatements(source: string): readonly string[] {
	if (/\$[A-Za-z_0-9]*\$/.test(source))
		throw new Error("Pre-diff migration overlays cannot contain dollar-quoted bodies");

	const statements: string[] = [];
	let start = 0;
	let state: "code" | "single" | "double" | "lineComment" | "blockComment" = "code";
	let blockDepth = 0;
	for (let index = 0; index < source.length; index += 1) {
		const current = source[index];
		const next = source[index + 1];
		if (state === "lineComment") {
			if (current === "\n") state = "code";
			continue;
		}
		if (state === "blockComment") {
			if (current === "/" && next === "*") {
				blockDepth += 1;
				index += 1;
			} else if (current === "*" && next === "/") {
				blockDepth -= 1;
				index += 1;
				if (blockDepth === 0) state = "code";
			}
			continue;
		}
		if (state === "single") {
			if (current === "'" && next === "'") index += 1;
			else if (current === "'") state = "code";
			continue;
		}
		if (state === "double") {
			if (current === '"' && next === '"') index += 1;
			else if (current === '"') state = "code";
			continue;
		}
		if (current === "-" && next === "-") {
			state = "lineComment";
			index += 1;
		} else if (current === "/" && next === "*") {
			state = "blockComment";
			blockDepth = 1;
			index += 1;
		} else if (current === "'") state = "single";
		else if (current === '"') state = "double";
		else if (current === ";") {
			const statement = source.slice(start, index + 1).trim();
			if (statement.replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/)/g, "").trim())
				statements.push(statement);
			start = index + 1;
		}
	}
	if (state !== "code" && state !== "lineComment")
		throw new Error("Pre-diff migration overlay contains an unterminated SQL construct");
	const trailing = source.slice(start).trim();
	if (trailing.replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/)/g, "").trim())
		throw new Error("Every pre-diff migration overlay statement must end with a semicolon");
	return statements;
}

/** @internal */
export async function applyOverlayStatements(
	client: OverlayQueryClient,
	statements: readonly string[],
	transactionMode: MigrationOverlayTransactionMode,
): Promise<void> {
	let transactionOpen = false;
	try {
		if (transactionMode === "file") {
			await client.query("BEGIN");
			transactionOpen = true;
		}
		for (const [index, statement] of statements.entries()) {
			try {
				await client.query(statement);
			} catch (error) {
				throw new Error(`Pre-diff migration overlay failed at statement ${index + 1}`, {
					cause: error,
				});
			}
		}
		if (transactionMode === "file") {
			await client.query("COMMIT");
			transactionOpen = false;
		}
	} catch (error) {
		if (transactionOpen) {
			try {
				await client.query("ROLLBACK");
			} catch (rollbackError) {
				throw new AggregateError([error, rollbackError], "Overlay execution and rollback failed");
			}
		}
		throw error;
	}
}

function assertDisposableShadowUrl(connectionString: string): void {
	const url = new URL(connectionString);
	if (!["postgres:", "postgresql:"].includes(url.protocol))
		throw new Error("DATABASE_ADMIN_URL must use the PostgreSQL protocol");
	if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname))
		throw new Error("Migration overlays may run only against a localhost shadow database");
	if (url.pathname !== `/${RequiredDatabaseName}`)
		throw new Error(`Migration overlays may run only against ${RequiredDatabaseName}`);
}

async function main(): Promise<void> {
	if (process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
		throw new Error("REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 is required");
	const connectionString = process.env.DATABASE_ADMIN_URL;
	if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");
	assertDisposableShadowUrl(connectionString);

	const requestedPath = process.argv[2];
	if (!requestedPath) throw new Error("A pre-diff migration overlay path is required");
	const transactionMode = process.argv[3];
	if (transactionMode !== "file" && transactionMode !== "none")
		throw new Error("Migration overlay transaction mode must be file or none");

	const overlayRoot = resolve(
		fileURLToPath(new URL(".", import.meta.url)),
		"../src/services/database/schema/postgres/migration-overlays",
	);
	const overlayPath = resolve(requestedPath);
	const relativePath = relative(overlayRoot, overlayPath);
	if (
		!relativePath ||
		relativePath.startsWith("..") ||
		relativePath.includes(":") ||
		!relativePath.endsWith(".pre.sql")
	)
		throw new Error("Migration overlay must be a .pre.sql file inside migration-overlays");

	const statements = splitSqlStatements(await readFile(overlayPath, "utf8"));
	if (statements.length === 0) throw new Error("Migration overlay contains no SQL statements");

	const client = new Client({
		connectionString,
		application_name: "rezics-migration-overlay",
	});
	await client.connect();
	let locked = false;
	try {
		const identity = await client.query<{ database_name: string }>(
			"select current_database() as database_name",
		);
		if (identity.rows[0]?.database_name !== RequiredDatabaseName)
			throw new Error("Connected database is not the disposable migration shadow");
		await client.query("select pg_advisory_lock($1)", [MigrationOverlayLockKey]);
		locked = true;
		await applyOverlayStatements(client, statements, transactionMode);
		console.info(`Applied ${statements.length} pre-diff migration overlay statements.`);
	} finally {
		if (locked) await client.query("select pg_advisory_unlock($1)", [MigrationOverlayLockKey]);
		await client.end();
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
