import { readFile } from "node:fs/promises";

import { AliasSearchScoreThreshold } from "../src/services/database/schema/contract-values";
import { CanonicalPgroongaIndexes } from "../src/services/database/schema/pgroonga";

const template = await readFile(
	new URL("../docker/postgres-verification/search-acceptance.sql.template", import.meta.url),
	"utf8",
);

const replacements = {
	ALIAS_INDEX: CanonicalPgroongaIndexes[2],
	CONTENT_INDEX: CanonicalPgroongaIndexes[1],
	METADATA_INDEX: CanonicalPgroongaIndexes[0],
} as const;

let rendered = template;
if (!Number.isSafeInteger(AliasSearchScoreThreshold) || AliasSearchScoreThreshold < 1) {
	throw new Error("Alias search score threshold must be a positive safe integer");
}
rendered = rendered.replaceAll("{{ALIAS_SCORE_THRESHOLD}}", String(AliasSearchScoreThreshold));
for (const [placeholder, indexName] of Object.entries(replacements)) {
	if (!/^[a-z][a-z0-9_]*$/.test(indexName)) {
		throw new Error(`Unsafe PGroonga index name: ${indexName}`);
	}
	rendered = rendered.replaceAll(`{{${placeholder}}}`, indexName);
}

if (rendered.includes("{{")) {
	throw new Error("Unresolved restore-acceptance SQL placeholder");
}

process.stdout.write(rendered);
