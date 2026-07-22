import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CurrentSearchProjectionVersion } from "./contracts";

const generationDate = "20260722";
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
	it("keeps the versioned index, sink, settings, and enrichment configuration aligned", async () => {
		const [environment, compose, sequin, settings, rootTaskfile, appHostTaskfile] =
			await Promise.all([
				readRepositoryFile(".env.example"),
				readRepositoryFile("compose.yaml"),
				readRepositoryFile("services/main/search/sequin.yaml"),
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
