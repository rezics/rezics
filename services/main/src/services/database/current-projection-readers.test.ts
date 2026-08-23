import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const serviceRoot = new URL("../", import.meta.url);
const productionReaders = [
	{
		path: "tag-structures/service.ts",
		currentExports: ["currentUnitStructureMember", "currentUnitStructureEdge"],
		baseExports: ["unitStructureMember", "unitStructureEdge"],
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
		currentExports: ["currentUnitEffectiveTag", "currentUnitStructureMember"],
		baseExports: ["unitEffectiveTag", "unitStructureMember"],
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
		currentExports: ["currentUnitStructureMember"],
		baseExports: ["unitStructureMember"],
	},
	{
		path: "api/unit-resources/index.ts",
		currentExports: ["currentUnitTagJudgmentStat"],
		baseExports: ["unitTagJudgmentStat"],
	},
] as const;

const rawBaseProjectionRead =
	/\b(?:from|join)\s+(?:public\.)?(?:unit_structure_(?:member|edge|end|primary_path_candidate)|unit_tag_structure_support|unit_effective_tag(?:_vote)?|unit_tag_judgment_stat|tag_primary_display_path)\b/i;

function schemaImportBlocks(source: string): readonly string[] {
	return Array.from(
		source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']*database\/schema["'];/g),
		(match) => match[1] ?? "",
	);
}

describe("VNDB v11 production projection readers", () => {
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
