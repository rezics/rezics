import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const serviceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const exemptionMarker = ["@UNIT", "LOCALIZATION", "EXEMPT"].join("_");

const reviewedExemptions = [
	{
		file: "scripts/generate-auth-schema.ts",
		rationale:
			"Identity source: provider-owned sign-in name; public Profile titles remain Unit localizations.",
	},
	{
		file: "src/services/database/schema/auth.ts",
		rationale:
			"Identity source: provider-owned sign-in name; public Profile titles remain Unit localizations.",
	},
	{
		file: "src/services/database/schema/collection-structure-history.ts",
		rationale: "Authored point-in-time edit summary, never interface copy.",
	},
	{
		file: "src/services/database/schema/communication.ts",
		rationale: "Authored snapshot: original direct message; translation would alter the message.",
	},
	{
		file: "src/services/database/schema/communication.ts",
		rationale: "Machine diagnostic for operators; never display copy.",
	},
	{
		file: "src/services/database/schema/communication.ts",
		rationale: "Machine diagnostic: raw delivery failure detail for operators, never display copy.",
	},
	{
		file: "src/services/database/schema/content-structure-history.ts",
		rationale: "Authored point-in-time edit summary, never interface copy.",
	},
	{
		file: "src/services/database/schema/custom-theme.ts",
		rationale: "Display copy is referenced through localized Units.",
	},
	{
		file: "src/services/database/schema/dock-history.ts",
		rationale: "Authored point-in-time edit summary, never interface copy.",
	},
	{
		file: "src/services/database/schema/dock.ts",
		rationale: "Structured contract: Dock display copy is referenced through localized Units.",
	},
	{
		file: "src/services/database/schema/history.ts",
		rationale: "Authored snapshot: original point-in-time edit summary, never interface copy.",
	},
	{
		file: "src/services/database/schema/recommendation.ts",
		rationale: "Machine diagnostic: raw snapshot failure detail for operators, never display copy.",
	},
	{
		file: "src/services/database/schema/unit.ts",
		rationale: "Search synonym: language-tagged lookup term, never canonical Unit display copy.",
	},
	{
		file: "src/services/database/schema/zone.ts",
		rationale: "Sparse Filter contract; `{}` adds no Zone conditions.",
	},
	{
		file: "src/services/database/schema/zone.ts",
		rationale: "Structured fallback appearance contains no display copy.",
	},
] as const;

async function listTypeScriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory()
				? listTypeScriptFiles(path)
				: Promise.resolve(entry.name.endsWith(".ts") ? [path] : []);
		}),
	);
	return files.flat();
}

describe("Unit localization exemptions", () => {
	it("keeps every source, snapshot, diagnostic, and structured exception reviewed", async () => {
		const files = (
			await Promise.all([
				listTypeScriptFiles(resolve(serviceRoot, "src")),
				listTypeScriptFiles(resolve(serviceRoot, "scripts")),
			])
		).flat();
		const expression = new RegExp(`${exemptionMarker}\\s+([^*]+?)\\s*\\*/`, "g");
		const found = (
			await Promise.all(
				files.map(async (file) => {
					const source = await readFile(file, "utf8");
					return [...source.matchAll(expression)].map((match) => ({
						file: relative(serviceRoot, file).split(sep).join("/"),
						rationale: match[1]?.trim(),
					}));
				}),
			)
		)
			.flat()
			.sort((left, right) =>
				`${left.file}:${left.rationale}`.localeCompare(`${right.file}:${right.rationale}`),
			);

		expect(found).toEqual(reviewedExemptions);
	});
});
