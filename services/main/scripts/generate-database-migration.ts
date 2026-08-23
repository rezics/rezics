import { spawn } from "node:child_process";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MigrationNamePattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const SyncedMessage = "Schemas are synced, no changes to be made.";
const OverlayOnlyMarkerSuffix = ".overlay-only";
const TransactionModeNoneMarkerSuffix = ".txmode-none";
const ShadowValidationOverlaySuffix = ".shadow-validated.sql";

interface MigrationSqlSections {
	readonly schemaDiff?: string;
	readonly preOverlay?: string;
	readonly canonicalSql?: string;
	readonly postOverlay?: string;
	readonly transactionModeNoneReason?: string;
}

interface MigrationGenerationSources {
	readonly hasPreOverlay: boolean;
	readonly hasPostOverlay: boolean;
	readonly hasCanonicalFile: boolean;
	readonly overlayOnlyReason?: string;
}

interface MigrationGenerationPlan {
	readonly applyPreOverlayToShadow: boolean;
	readonly includeCanonicalSql: boolean;
	readonly runSchemaDiff: boolean;
}

function containsConcurrentKeyword(source: string): boolean {
	let code = "";
	let state: "code" | "single" | "double" | "lineComment" | "blockComment" | "dollar" = "code";
	let blockDepth = 0;
	let dollarDelimiter = "";

	for (let index = 0; index < source.length; index += 1) {
		const current = source[index];
		const next = source[index + 1];
		if (state === "lineComment") {
			if (current === "\n") {
				state = "code";
				code += "\n";
			}
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
		if (state === "dollar") {
			if (source.startsWith(dollarDelimiter, index)) {
				index += dollarDelimiter.length - 1;
				state = "code";
			}
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
		else if (current === "$") {
			const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(index));
			if (match) {
				dollarDelimiter = match[0];
				state = "dollar";
				index += dollarDelimiter.length - 1;
			} else code += current;
		} else code += current;
	}

	return /\bCONCURRENTLY\b/i.test(code);
}

function splitSqlStatements(source: string): readonly string[] {
	if (/\$[A-Za-z_0-9]*\$/.test(source))
		throw new Error("Transaction-mode-none migrations cannot contain dollar-quoted bodies");

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
			statements.push(source.slice(start, index + 1));
			start = index + 1;
		}
	}
	if (state !== "code" && state !== "lineComment")
		throw new Error("Transaction-mode-none migration contains unterminated SQL");
	if (
		source
			.slice(start)
			.replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/)/g, "")
			.trim()
	)
		throw new Error("Every transaction-mode-none statement must end with a semicolon");
	return statements;
}

function assertTransactionModeNoneIsResumeSafe(source: string): void {
	for (const statement of splitSqlStatements(source)) {
		const code = statement
			.replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*/, "")
			.trim();
		const identifier = "[a-z_][a-z0-9_$]*";
		const indexElement = `${identifier}(?:\\s+(?:ASC|DESC))?(?:\\s+NULLS\\s+(?:FIRST|LAST))?`;
		const indexElements = `\\(\\s*${indexElement}(?:\\s*,\\s*${indexElement})*\\s*\\)`;
		const include = `(?:\\s+INCLUDE\\s+\\(\\s*${identifier}(?:\\s*,\\s*${identifier})*\\s*\\))?`;
		const scalar = "(?:-?\\d+(?:\\.\\d+)?|'(?:''|[^'])*'|TRUE|FALSE|NULL)";
		const predicateAtom = `(?:${identifier}(?:\\s+IS\\s+(?:NOT\\s+)?NULL|\\s*(?:=|<>|!=|<=|>=|<|>)\\s*${scalar})|${identifier})`;
		const predicate = `(?:\\s+WHERE\\s+${predicateAtom}(?:\\s+AND\\s+${predicateAtom})*)?`;
		const createIndex = new RegExp(
			`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+CONCURRENTLY\\s+(?!IF\\s+NOT\\s+EXISTS\\b)${identifier}\\s+ON\\s+public\\.${identifier}(?:\\s+USING\\s+btree)?\\s+${indexElements}${include}${predicate}\\s*;\\s*$`,
			"is",
		);
		const vettedPathCorrectionShardIndexes = [
			new RegExp(
				"^CREATE\\s+INDEX\\s+CONCURRENTLY\\s+unit_structure_application_correction_shard_idx\\s+ON\\s+public\\.unit_structure_application(?:\\s+USING\\s+btree)?\\s+\\(\\s*structure_id\\s*,\\s*\\(\\s*pg_catalog\\.get_byte\\(\\s*pg_catalog\\.uuid_send\\(\\s*unit_id\\s*\\)\\s*,\\s*15\\s*\\)\\s*\\)\\s*,\\s*unit_id\\s*\\)\\s*;\\s*$",
				"is",
			),
			new RegExp(
				"^CREATE\\s+INDEX\\s+CONCURRENTLY\\s+unit_structure_application_judgment_positive_correction_shard_idx\\s+ON\\s+public\\.unit_structure_application_judgment(?:\\s+USING\\s+btree)?\\s+\\(\\s*structure_id\\s*,\\s*\\(\\s*pg_catalog\\.get_byte\\(\\s*pg_catalog\\.uuid_send\\(\\s*unit_id\\s*\\)\\s*,\\s*15\\s*\\)\\s*\\)\\s*,\\s*unit_id\\s*,\\s*profile_id\\s*\\)\\s+WHERE\\s+fit_vote\\s*=\\s*1\\s*;\\s*$",
				"is",
			),
		];
		const dropIndex =
			/^DROP\s+INDEX\s+CONCURRENTLY\s+(?:IF\s+EXISTS\s+)?public\.[a-z_][a-z0-9_$]*\s*;\s*$/is;
		if (
			!createIndex.test(code) &&
			!vettedPathCorrectionShardIndexes.some((pattern) => pattern.test(code)) &&
			!dropIndex.test(code)
		)
			throw new Error(
				"Transaction-mode-none migrations may contain only dependency-free, schema-anchored CREATE/DROP INDEX CONCURRENTLY statements; CREATE must use simple columns or one of the two vetted pg_catalog-only Path-correction shard expressions on a public-qualified table and omit IF NOT EXISTS, while DROP must qualify its public index",
			);
	}
}

/** @internal */
export function planMigrationGeneration(
	sources: MigrationGenerationSources,
): MigrationGenerationPlan {
	const hasOverlayOnlyMarker = sources.overlayOnlyReason !== undefined;
	const overlayOnlyReason = sources.overlayOnlyReason?.trim();
	if (hasOverlayOnlyMarker && !overlayOnlyReason)
		throw new Error(`Overlay-only opt-in ${OverlayOnlyMarkerSuffix} reason is empty`);
	if (!hasOverlayOnlyMarker)
		return {
			applyPreOverlayToShadow: sources.hasPreOverlay,
			includeCanonicalSql: sources.hasCanonicalFile,
			runSchemaDiff: true,
		};
	if (!sources.hasPreOverlay && !sources.hasPostOverlay)
		throw new Error(
			`Overlay-only opt-in ${OverlayOnlyMarkerSuffix} requires a .pre.sql or .post.sql overlay`,
		);
	if (sources.hasCanonicalFile)
		throw new Error(
			`Overlay-only opt-in ${OverlayOnlyMarkerSuffix} cannot be combined with canonical SQL`,
		);
	return {
		applyPreOverlayToShadow: sources.hasPreOverlay,
		includeCanonicalSql: false,
		runSchemaDiff: false,
	};
}

/** @internal */
export function composeMigrationSql(sections: MigrationSqlSections): string {
	const transactionModeNoneReason = sections.transactionModeNoneReason?.trim();
	if (sections.transactionModeNoneReason !== undefined && !transactionModeNoneReason)
		throw new Error(`Transaction-mode opt-in ${TransactionModeNoneMarkerSuffix} reason is empty`);

	const sqlSections = [
		...(transactionModeNoneReason ? [] : ["SET search_path TO public;"]),
		sections.preOverlay?.trimEnd(),
		sections.schemaDiff?.trimEnd(),
		sections.canonicalSql?.trimEnd(),
		sections.postOverlay?.trimEnd(),
	].filter((section): section is string => Boolean(section));
	const sqlBody = sqlSections.join("\n\n");
	if (containsConcurrentKeyword(sqlBody) && !transactionModeNoneReason)
		throw new Error(
			`Migration SQL contains CONCURRENTLY but has no non-empty ${TransactionModeNoneMarkerSuffix} opt-in`,
		);
	if (transactionModeNoneReason) assertTransactionModeNoneIsResumeSafe(sqlBody);

	return `${[...(transactionModeNoneReason ? ["-- atlas:txmode none"] : []), ...sqlSections].join(
		"\n\n",
	)}\n`;
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

async function runYarn(
	arguments_: readonly string[],
	options: {
		readonly cwd: string;
		readonly env?: NodeJS.ProcessEnv;
		readonly captureStdout?: boolean;
	},
): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const isWindows = process.platform === "win32";
		const yarnCli = isWindows
			? resolve(dirname(process.execPath), "node_modules/corepack/dist/yarn.js")
			: undefined;
		const command = yarnCli ? process.execPath : "yarn";
		const childArguments = yarnCli ? [yarnCli, ...arguments_] : arguments_;
		const child = spawn(command, childArguments, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			stdio: options.captureStdout ? ["ignore", "pipe", "inherit"] : "inherit",
			windowsHide: true,
		});
		const output: Buffer[] = [];
		if (options.captureStdout) child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolvePromise(Buffer.concat(output).toString("utf8"));
			else
				reject(
					new Error(`yarn ${arguments_.join(" ")} exited with ${signal ?? `code ${String(code)}`}`),
				);
		});
	});
}

function utcMigrationVersion(date: Date): string {
	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
		String(date.getUTCHours()).padStart(2, "0"),
		String(date.getUTCMinutes()).padStart(2, "0"),
		String(date.getUTCSeconds()).padStart(2, "0"),
	].join("");
}

async function main(): Promise<void> {
	const migrationName = process.argv[2];
	if (!migrationName) throw new Error("Usage: generate-database-migration.ts <snake_case_name>");
	if (migrationName.length > 80 || !MigrationNamePattern.test(migrationName))
		throw new Error(`Migration name must be lower snake_case: ${migrationName}`);

	const serviceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
	const repositoryRoot = resolve(serviceRoot, "../..");
	const migrationDirectory = join(serviceRoot, "src/services/database/migrations");
	const postgresSchemaDirectory = join(serviceRoot, "src/services/database/schema/postgres");
	const overlayDirectory = join(postgresSchemaDirectory, "migration-overlays");
	const preOverlay = join(overlayDirectory, `${migrationName}.pre.sql`);
	const postOverlay = join(overlayDirectory, `${migrationName}.post.sql`);
	const overlayOnlyMarker = join(overlayDirectory, `${migrationName}${OverlayOnlyMarkerSuffix}`);
	const transactionModeNoneMarker = join(
		overlayDirectory,
		`${migrationName}${TransactionModeNoneMarkerSuffix}`,
	);
	const shadowValidationOverlay = join(
		overlayDirectory,
		`${migrationName}${ShadowValidationOverlaySuffix}`,
	);
	const canonicalFile = join(postgresSchemaDirectory, `${migrationName.replaceAll("_", "-")}.sql`);

	const migrationPort = process.env.POSTGRES_MIGRATION_LOCAL_PORT ?? "5433";
	const parsedPort = Number(migrationPort);
	if (!/^\d+$/.test(migrationPort) || parsedPort < 1 || parsedPort > 65_535)
		throw new Error(`Invalid POSTGRES_MIGRATION_LOCAL_PORT: ${migrationPort}`);
	const shadowUrl = `postgres://postgres:postgres@localhost:${migrationPort}/rezics_atlas?search_path=public&sslmode=disable`;

	await mkdir(join(repositoryRoot, ".temp"), { recursive: true });
	const workDirectory = await mkdtemp(join(repositoryRoot, ".temp/database-migration-"));
	const checksum = join(migrationDirectory, "atlas.sum");
	const checksumBackup = join(workDirectory, "atlas.sum");
	await copyFile(checksum, checksumBackup);
	let targetFile: string | undefined;
	let completed = false;
	try {
		const hasPreOverlay = await exists(preOverlay);
		const hasPostOverlay = await exists(postOverlay);
		const hasCanonicalFile = await exists(canonicalFile);
		const hasOverlayOnlyMarker = await exists(overlayOnlyMarker);
		const overlayOnlyReason = hasOverlayOnlyMarker
			? await readFile(overlayOnlyMarker, "utf8")
			: undefined;
		const generationPlan = planMigrationGeneration({
			hasPreOverlay,
			hasPostOverlay,
			hasCanonicalFile,
			...(hasOverlayOnlyMarker ? { overlayOnlyReason } : {}),
		});
		const hasTransactionModeNoneMarker = await exists(transactionModeNoneMarker);
		const hasShadowValidationOverlay = await exists(shadowValidationOverlay);
		const transactionModeNoneReason = hasTransactionModeNoneMarker
			? (await readFile(transactionModeNoneMarker, "utf8")).trim()
			: undefined;
		if (hasTransactionModeNoneMarker && !transactionModeNoneReason)
			throw new Error(
				`Transaction-mode opt-in marker must contain a reason: ${transactionModeNoneMarker}`,
			);
		if (hasTransactionModeNoneMarker && hasPreOverlay)
			assertTransactionModeNoneIsResumeSafe(await readFile(preOverlay, "utf8"));
		if (hasShadowValidationOverlay && !generationPlan.runSchemaDiff)
			throw new Error(
				`${ShadowValidationOverlaySuffix} requires a schema-diff migration; overlay-only migrations cannot model external validation state`,
			);
		if (hasShadowValidationOverlay && hasTransactionModeNoneMarker)
			throw new Error(
				`${ShadowValidationOverlaySuffix} cannot be combined with ${TransactionModeNoneMarkerSuffix}`,
			);
		if (hasShadowValidationOverlay)
			await runYarn(
				[
					"exec",
					"tsx",
					join(serviceRoot, "scripts/apply-database-migration-overlay.ts"),
					shadowValidationOverlay,
					"file",
				],
				{
					cwd: serviceRoot,
					env: {
						...process.env,
						DATABASE_ADMIN_URL: shadowUrl,
						REZICS_DISPOSABLE_MIGRATION_FIXTURE: "1",
					},
				},
			);
		if (generationPlan.applyPreOverlayToShadow)
			await runYarn(
				[
					"exec",
					"tsx",
					join(serviceRoot, "scripts/apply-database-migration-overlay.ts"),
					preOverlay,
					hasTransactionModeNoneMarker ? "none" : "file",
				],
				{
					cwd: serviceRoot,
					env: {
						...process.env,
						DATABASE_ADMIN_URL: shadowUrl,
						REZICS_DISPOSABLE_MIGRATION_FIXTURE: "1",
					},
				},
			);

		let schemaDiff = "";
		if (generationPlan.runSchemaDiff) {
			const draft = await runYarn(
				[
					"exec",
					"atlas",
					"schema",
					"diff",
					"--env",
					"main",
					"--from",
					shadowUrl,
					"--to",
					"env://schema.src",
					"--exclude",
					"atlas_schema_revisions",
					"--exclude",
					"*[type=extension|function|trigger]",
					"--exclude",
					"unit_localization.unit_localization_pgroonga_*[type=index]",
				],
				{ cwd: serviceRoot, captureStdout: true },
			);
			schemaDiff = draft.trim() === SyncedMessage ? "" : draft.trimEnd();
		}
		if (!schemaDiff && !hasPreOverlay && !hasPostOverlay && !generationPlan.includeCanonicalSql) {
			console.info(`${SyncedMessage} No migration was created.`);
			completed = true;
			return;
		}

		const migrationFiles = (await readdir(migrationDirectory))
			.map((fileName) => /^(\d{14})_.+\.sql$/.exec(fileName)?.[1])
			.filter((version): version is string => version !== undefined)
			.sort();
		const latestVersion = migrationFiles.at(-1);
		if (!latestVersion) throw new Error("Migration directory has no versioned SQL files");
		const migrationVersion = utcMigrationVersion(new Date());
		if (migrationVersion <= latestVersion)
			throw new Error(
				`Current UTC migration version ${migrationVersion} must be later than ${latestVersion}`,
			);
		targetFile = join(migrationDirectory, `${migrationVersion}_${migrationName}.sql`);
		if (await exists(targetFile)) throw new Error(`Migration target already exists: ${targetFile}`);

		const migrationSql = composeMigrationSql({
			...(hasPreOverlay ? { preOverlay: await readFile(preOverlay, "utf8") } : {}),
			...(schemaDiff ? { schemaDiff } : {}),
			...(generationPlan.includeCanonicalSql
				? { canonicalSql: await readFile(canonicalFile, "utf8") }
				: {}),
			...(hasPostOverlay ? { postOverlay: await readFile(postOverlay, "utf8") } : {}),
			...(transactionModeNoneReason ? { transactionModeNoneReason } : {}),
		});
		const composedFile = join(workDirectory, "composed.sql");
		await writeFile(composedFile, migrationSql, "utf8");
		await rename(composedFile, targetFile);
		await runYarn(["exec", "atlas", "migrate", "hash", "--env", "main"], {
			cwd: serviceRoot,
		});
		completed = true;
		console.info(`Created reviewed migration draft: ${targetFile}`);
	} finally {
		if (!completed) {
			if (targetFile) await rm(targetFile, { force: true });
			await copyFile(checksumBackup, checksum);
		}
		await rm(workDirectory, { force: true, recursive: true });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
