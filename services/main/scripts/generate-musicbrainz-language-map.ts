import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";

const input = process.argv[2];
const mode = process.argv[3];
if (!input || !["--write", "--check"].includes(mode ?? ""))
	throw new Error(
		"Usage: bun generate-musicbrainz-language-map.ts <pinned iso_639-3.json> --write|--check",
	);
const bytes = await readFile(input);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (
	bytes.byteLength > 2000000 ||
	sha256 !== "2c61a9bb90a8c50c46bfbab484838863a12335bfdd0a92b4809f3faf1756b22d"
)
	throw new Error("Language mapping input differs from its reviewed iso-codes revision");
const source = z
	.object({
		"639-3": z
			.array(
				z.object({
					alpha_3: z.string().regex(/^[a-z]{3}$/u),
					alpha_2: z
						.string()
						.regex(/^[a-z]{2}$/u)
						.optional(),
					bibliographic: z
						.string()
						.regex(/^[a-z]{3}$/u)
						.optional(),
				}),
			)
			.max(50000),
	})
	.parse(JSON.parse(bytes.toString("utf8")));
const aliases: Record<string, string> = {};
for (const language of source["639-3"]) {
	if (!language.alpha_2) continue;
	const target = canonicalizeContentLanguageTag(language.alpha_2);
	for (const code of [language.alpha_3, language.bibliographic])
		if (code) {
			if (aliases[code] && aliases[code] !== target)
				throw new Error("Conflicting ISO language equivalence");
			aliases[code] = target;
		}
}
const body = `${JSON.stringify({ generatedBy: "services/main/scripts/generate-musicbrainz-language-map.ts", source: "https://salsa.debian.org/iso-codes-team/iso-codes/-/blob/a6ff93c36b9f3804a9e87bba1f7cfe41e515446f/data/iso_639-3.json", sourceSha256: sha256, sourceRows: source["639-3"].length, copyright: "2016 Dr. Tobias Quathamer <toddy@debian.org>", license: "LGPL-2.1-or-later", aliases: Object.fromEntries(Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right, "en"))) }, null, "\t")}\n`;
const output = new URL(
	"../src/services/catalog/source-contracts/musicbrainz-language-map.json",
	import.meta.url,
);
if (mode === "--write") await writeFile(output, body);
else if ((await readFile(output, "utf8")) !== body)
	throw new Error("Generated MusicBrainz language mapping drift");
console.info(
	`Verified ${source["639-3"].length} pinned language records and ${Object.keys(aliases).length} ISO-to-BCP47 aliases`,
);
