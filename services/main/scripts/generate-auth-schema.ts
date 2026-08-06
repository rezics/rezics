import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getAdapter } from "better-auth/db/adapter";
import { auth } from "../src/services/auth";
import { formatWithBiome } from "./format-with-biome";

const schemaPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../src/services/database/schema/auth.ts",
);

const adapter = await getAdapter(auth.options);
const generated = await adapter.createSchema?.(auth.options, schemaPath);

if (!generated?.code) {
	throw new Error("The Better Auth adapter did not return a schema.");
}

const TimestampOptions = "{ withTimezone: true, precision: 3 }";

let code = generated.code
	.replace("  pgTable,\n", "")
	.replace("  index,\n", "  index,\n  uniqueIndex,\n")
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
	)
	.replace(
		'(table) => [index("accounts_user_id_idx").on(table.userId)],',
		`(table) => [
		uniqueIndex("accounts_provider_id_account_id_key").on(
			table.providerId,
			table.accountId,
		),
		index("accounts_user_id_idx").on(table.userId),
	],`,
	);

code = await formatWithBiome(code, schemaPath);

const current = await readFile(schemaPath, "utf8").catch(() => "");
if (current !== code) {
	await writeFile(schemaPath, code);
	console.log("Generated the auth schema.");
} else {
	console.log("Auth schema is already current.");
}
