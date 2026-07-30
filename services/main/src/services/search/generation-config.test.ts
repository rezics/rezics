import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { TimedMediaUnitKindValues } from "../database/schema";
import { CurrentSearchProjectionVersion, CurrentSearchUnitKindsByCategory } from "./contracts";
import { getSearchSettingsFingerprint, SearchProjectionSettings } from "./settings";

const currentSettingsGenerationDates = new Map([
	["bd2f6511f881cd25ea9919b272143ea8e5433fe62da5e9cf809ef0a456781176", "20260726"],
	["801c99608f68b41d09c7fbd65bac885f16866b686794ce6b74c937e2fa5504d1", "20260729"],
]);
const currentSettingsFingerprint = getSearchSettingsFingerprint("current");
const generationDate = currentSettingsGenerationDates.get(currentSettingsFingerprint);
if (!generationDate)
	throw new Error(
		`Current search settings fingerprint ${currentSettingsFingerprint} has no dated generation`,
	);
const currentIndexUid = `rezics_units_v${CurrentSearchProjectionVersion}_${generationDate}`;
const currentSinkName = currentIndexUid.replaceAll("_", "-");

async function readRepositoryFile(path: string): Promise<string> {
	return readFile(new URL(`../../../../../${path}`, import.meta.url), "utf8");
}

function taskDefinition(taskfile: string, name: string): string {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = taskfile.match(
		new RegExp(`^    ${escapedName}:\\n([\\s\\S]*?)(?=^    [^ \\n]+:|(?![\\s\\S]))`, "m"),
	);
	if (!match?.[0]) throw new Error(`Task ${name} is missing`);
	return match[0];
}

describe("current search generation deployment wiring", () => {
	it("makes explicit result ordering authoritative over relevance ranking", () => {
		expect(SearchProjectionSettings.current.rankingRules[0]).toBe("sort");
	});

	it("treats every localized title as first-class relevance input", () => {
		expect(SearchProjectionSettings.current.searchableAttributes.slice(0, 2)).toEqual([
			"search.titles",
			"search.primaryTitles",
		]);
	});

	it("keeps the versioned index, sink, settings, and enrichment configuration aligned", async () => {
		const [environment, compose, sequin, enrichment, settings, rootTaskfile, appHostTaskfile] =
			await Promise.all([
				readRepositoryFile(".env.example"),
				readRepositoryFile("compose.yaml"),
				readRepositoryFile("services/main/search/sequin.yaml"),
				readRepositoryFile(
					`services/main/search/rezics_unit_search_document_v${CurrentSearchProjectionVersion}.sql`,
				),
				readRepositoryFile("services/main/src/services/search/settings.ts"),
				readRepositoryFile("Taskfile.yml"),
				readRepositoryFile("aspire-apphost/Taskfile.yml"),
			]);

		expect(environment).toContain(`MEILISEARCH_CURRENT_INDEX_UID=${currentIndexUid}`);
		expect(environment).toContain(`MEILISEARCH_CURRENT_SINK_NAME=${currentSinkName}`);
		expect(compose).toContain(`MEILISEARCH_CURRENT_INDEX_UID:-${currentIndexUid}`);
		expect(compose).toContain(`MEILISEARCH_CURRENT_SINK_NAME:-${currentSinkName}`);
		expect(sequin).toContain(`MEILISEARCH_CURRENT_INDEX_UID:-${currentIndexUid}`);
		expect(sequin).toContain(`MEILISEARCH_CURRENT_SINK_NAME:-${currentSinkName}`);
		expect(sequin).toContain(
			`name: "rezics-unit-search-document-v${CurrentSearchProjectionVersion}"`,
		);
		expect(sequin).toContain(
			`file: "rezics_unit_search_document_v${CurrentSearchProjectionVersion}.sql"`,
		);
		expect(enrichment).toContain(`'projectionVersion', ${CurrentSearchProjectionVersion}`);
		expect(CurrentSearchUnitKindsByCategory.units).toEqual(
			expect.arrayContaining([...TimedMediaUnitKindValues]),
		);
		expect(enrichment).toContain(
			`WHEN unit_row.kind IN (${CurrentSearchUnitKindsByCategory.units
				.map((kind) => `'${kind}'`)
				.join(", ")}) THEN 'units'`,
		);
		expect(enrichment).toContain("WHEN unit_row.kind = 'realm' THEN 'realms'");
		expect(settings).toContain(`"./settings/current-v${CurrentSearchProjectionVersion}.json"`);
		for (const taskfile of [rootTaskfile, appHostTaskfile])
			expect(taskfile).toContain("{{.MEILISEARCH_CURRENT_INDEX_UID}}");
	});

	it("keeps routine startup read-only while making rebuild and configuration replacement explicit", async () => {
		const [rootTaskfile, appHostTaskfile] = await Promise.all([
			readRepositoryFile("Taskfile.yml"),
			readRepositoryFile("aspire-apphost/Taskfile.yml"),
		]);

		const run = taskDefinition(appHostTaskfile, "run");
		expect(run).toContain("search:index -- check --projection current");
		expect(run).not.toContain("search:index -- prepare");
		expect(run).not.toContain("search:index -- reconcile");
		expect(run).not.toContain("search:index -- promote");

		const searchStart = taskDefinition(rootTaskfile, "infra:search:start");
		expect(searchStart).not.toContain("--force-recreate");
		expect(taskDefinition(rootTaskfile, "infra:search:apply")).toContain("--force-recreate");
		expect(taskDefinition(rootTaskfile, "local:search:rebuild")).toContain(
			"rebuild-local --projection current",
		);
		expect(taskDefinition(rootTaskfile, "local:reset")).toContain(
			"rebuild-local --projection current",
		);
	});
});
