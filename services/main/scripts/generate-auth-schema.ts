import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getAdapter } from "better-auth/db/adapter";
import { format, resolveConfig } from "prettier";
import { auth } from "../src/services/auth";

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

code = await format(code, {
	...(await resolveConfig(schemaPath)),
	parser: "typescript",
});

const current = await readFile(schemaPath, "utf8").catch(() => "");
if (current !== code) {
	await writeFile(schemaPath, code);
	console.log("Generated the auth schema.");
} else {
	console.log("Auth schema is already current.");
}
