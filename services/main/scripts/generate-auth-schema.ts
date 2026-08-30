import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeObservability } from "@rezics/observability";
import { getAdapter } from "better-auth/db/adapter";
import { RezicsVersion } from "../src/version";
import { formatWithBiome } from "./format-with-biome";

const schemaPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../src/services/database/schema/auth.ts",
);

const observability = initializeObservability({
	service: {
		name: "rezics-auth-schema-generator",
		version: RezicsVersion,
		environment: "tooling",
	},
});

function replaceRequired(
	source: string,
	search: string | RegExp,
	replacement: string,
	label: string,
) {
	const replaced = source.replace(search, replacement);
	if (replaced === source)
		throw new Error(`Better Auth schema output no longer contains ${label}.`);
	return replaced;
}

function preserveProjectUserContract(source: string) {
	const start = source.indexOf('export const users = pgTable("users", {');
	const end = source.indexOf("\n\nexport const sessions", start);
	if (start < 0 || end < 0)
		throw new Error("Better Auth schema output no longer contains the users table.");

	let users = source.slice(start, end);
	users = replaceRequired(
		users,
		'export const users = pgTable("users", {',
		'export const users = pgTable(\n\t"users",\n\t{',
		"the expected users table declaration",
	);
	users = replaceRequired(
		users,
		/registrationContentLanguage: text\("registration_content_language", \{\s*enum: \[[^\]]+\],\s*\}\)\.default\("en"\),/,
		`registrationContentLanguage: text("registration_content_language")
			.$type<ContentLanguage>()
			.default("en")
			.notNull(),`,
		"the generated registration content language field",
	);
	users = replaceRequired(
		users,
		/\n\}\);$/,
		`\n\t},
	(table) => [
		check(
			"users_registration_content_language_check",
			inArray(table.registrationContentLanguage, ContentLanguageValues),
		),
	],
);`,
		"the users table terminator",
	);

	return `${source.slice(0, start)}${users}${source.slice(end)}`;
}

try {
	const { auth } = await import("../src/services/auth");
	const adapter = await getAdapter(auth.options);
	const generated = await adapter.createSchema?.(auth.options, schemaPath);

	if (!generated?.code) throw new Error("The Better Auth adapter did not return a schema.");

	const TimestampOptions = "{ withTimezone: true, precision: 3 }";

	let code = generated.code
		.replace("  pgTable,\n", "")
		.replace(
			'from "drizzle-orm/pg-core";',
			'from "drizzle-orm/pg-core";\nimport { pgTable } from "./base";',
		)
		.replaceAll("pg_catalog.gen_random_uuid()", "uuidv7()")
		.replaceAll(/timestamp\("([^"]+)"\)/g, `timestamp("$1", ${TimestampOptions})`)
		.replaceAll(
			/timestamp\("updated_at", \{ withTimezone: true, precision: 3 \}\)(\s*)\.\$onUpdate/g,
			`timestamp("updated_at", ${TimestampOptions}).defaultNow()$1.$onUpdate`,
		)
		.replaceAll("sessions_userId_idx", "sessions_user_id_idx")
		.replaceAll("accounts_userId_idx", "accounts_user_id_idx")
		.replaceAll("apikeys_configId_idx", "apikeys_config_id_idx")
		.replaceAll("apikeys_referenceId_idx", "apikeys_reference_id_idx")
		.replaceAll('index("apikeys_key_idx")', 'uniqueIndex("apikeys_key_key")')
		.replace(
			'referenceId: text("reference_id").notNull(),',
			`referenceId: uuid("reference_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),`,
		)
		.replace(
			'name: text("name").notNull(),',
			'/** @UNIT_LOCALIZATION_EXEMPT Identity source: provider-owned sign-in name; public Profile titles remain Unit localizations. */\nname: text("name").notNull(),',
		);

	code = await formatWithBiome(code, schemaPath);
	code = replaceRequired(
		code,
		'import { defineRelationsPart, sql } from "drizzle-orm";',
		'import { defineRelationsPart, inArray, sql } from "drizzle-orm";\nimport { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";',
		"the generated Drizzle import",
	);
	code = replaceRequired(
		code,
		'import { text, timestamp, boolean, integer, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";',
		'import { text, timestamp, boolean, check, integer, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";',
		"the generated PostgreSQL column imports",
	);
	code = preserveProjectUserContract(code);
	code = replaceRequired(
		code,
		'\t\tissuer: text("issuer").notNull(),',
		'\t\tissuer: text("issuer").default("local:credential").notNull(),',
		"the generated account issuer field",
	);
	code = replaceRequired(
		code,
		'\t\tuniqueIndex("accounts_issuer_accountId_uidx").on(table.issuer, table.accountId),',
		`\t\tuniqueIndex("accounts_provider_id_account_id_key").on(table.providerId, table.accountId),
		uniqueIndex("accounts_issuer_account_id_key").on(table.issuer, table.accountId),`,
		"the generated account identity index",
	);

	code = await formatWithBiome(code, schemaPath);

	const current = await readFile(schemaPath, "utf8").catch(() => "");
	if (current !== code) {
		await writeFile(schemaPath, code);
		console.log("Generated the auth schema.");
	} else {
		console.log("Auth schema is already current.");
	}
} finally {
	await observability.shutdown();
}
