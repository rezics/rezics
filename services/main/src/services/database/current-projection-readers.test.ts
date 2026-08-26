import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const serviceRoot = new URL("../", import.meta.url);
const productionReaders = [
	{
		path: "tag-paths/service.ts",
		currentExports: ["currentTagPathMember", "currentTagPathEdge"],
		baseExports: ["tagPathMember", "tagPathEdge"],
	},
	{
		path: "tags/service.ts",
		currentExports: [
			"currentUnitEffectiveTag",
			"currentUnitEffectiveTagVote",
			"currentUnitTagJudgmentStat",
		],
		baseExports: ["unitEffectiveTag", "unitEffectiveTagVote", "unitTagJudgmentStat"],
	},
	{
		path: "tags/curation.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
	{
		path: "search/service.ts",
		currentExports: ["currentUnitEffectiveTag", "currentTagPathMember"],
		baseExports: ["unitEffectiveTag", "tagPathMember"],
	},
	{
		path: "filter/sql.ts",
		currentExports: ["currentUnitEffectiveTag", "currentUnitTagJudgmentStat"],
		baseExports: ["unitEffectiveTag", "unitTagJudgmentStat"],
	},
	{
		path: "units/service.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
	{
		path: "units/association-context.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
	{
		path: "units/subject-association-tags.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
	{
		path: "api/feed/index.ts",
		currentExports: ["currentTagPathMember"],
		baseExports: ["tagPathMember"],
	},
	{
		path: "api/unit-resources/index.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
] as const;

const rawBaseProjectionRead =
	/\b(?:from|join)\s+(?:public\.)?(?:tag_path_(?:member|edge)|unit_tag_path_support|unit_effective_tag(?:_vote)?|unit_tag_judgment_stat)\b/i;

function schemaImportBlocks(source: string): readonly string[] {
	return Array.from(
		source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']*database\/schema["'];/g),
		(match) => match[1] ?? "",
	);
}

describe("Tag judgment projection readers", () => {
	for (const reader of productionReaders) {
		it(`${reader.path} reads through typed current views`, () => {
			const source = readFileSync(fileURLToPath(new URL(reader.path, serviceRoot)), "utf8");
			const imports = schemaImportBlocks(source);
			expect(imports.length).toBeGreaterThan(0);
			for (const currentExport of reader.currentExports) expect(source).toContain(currentExport);
			for (const baseExport of reader.baseExports) {
				const bareBaseImport = new RegExp(`(?:^|,)\\s*${baseExport}\\s*(?:,|$)`, "m");
				expect(imports.some((block) => bareBaseImport.test(block))).toBe(false);
			}
			expect(source).not.toMatch(rawBaseProjectionRead);
		});
	}
});
