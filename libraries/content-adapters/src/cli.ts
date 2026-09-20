import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProviderSchemas, convertProviderSchemas } from "./convert";
import { readProviderAcquisition } from "./acquisition";
import { convertWikibase } from "./readers/wikibase";
import { convertIiif } from "./readers/iiif";
import { convertMediaFragment } from "./readers/media-fragments";
const root = fileURLToPath(new URL("../", import.meta.url));
const [command, source, ...args] = process.argv.slice(2);
const write = async (path: string, value: unknown) => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(value, null, "\t") + "\n");
};
if (command === "fetch-contracts") {
	const receipt = await fetchProviderSchemas(source ?? "all");
	console.info(
		JSON.stringify({
			runId: receipt.runId,
			scope: receipt.scope,
			artifacts: receipt.artifacts.length,
			completedAt: receipt.completedAt,
		}),
	);
} else if (command === "contracts") {
	const acquisition = await readProviderAcquisition(source ?? "all");
	const records = await convertProviderSchemas(source ?? "all", acquisition);
	for (const provider of [...new Set(records.map((record) => record.source))])
		await write(
			resolve(root, `generated/${provider}/contracts.json`),
			records.filter((record) => record.source === provider),
		);
	const coverage = {
		acquisition: {
			runId: acquisition.receipt.runId,
			completedAt: acquisition.receipt.completedAt,
			scope: acquisition.receipt.scope,
		},
		freshness: "Captured run; no new network observation during conversion",
		sources: [...new Set(records.map((record) => record.source))],
		contracts: records.length,
		fields: records.reduce((n, r) => n + r.fields.length, 0),
		scope: "provider input contracts; not native schema or content adoption",
	};
	await write(resolve(root, `generated/${source ?? "all"}-coverage.json`), coverage);
	console.info(JSON.stringify(coverage, null, 2));
} else if (command === "convert") {
	if (!args[0]) throw new TypeError("Supply a content document or media URI");
	let output: unknown;
	if (source === "media-fragments") output = convertMediaFragment(args[0]);
	else {
		const bytes = await readFile(resolve(args[0]));
		if (bytes.byteLength > 67_108_864)
			throw new RangeError("Content document exceeds the 64 MiB conversion budget");
		const input = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
		if (source === "wikibase") output = convertWikibase(input);
		else if (source === "iiif") output = convertIiif(input);
		else
			throw new TypeError(
				"Use the owning main-service adapters for Bangumi, MusicBrainz, VNDB and Open Library native adoption",
			);
	}
	if (args[1]) await write(resolve(args[1]), output);
	else console.info(JSON.stringify(output, null, 2));
} else
	throw new TypeError(
		"Use fetch-contracts [provider|all] | contracts [provider|all] | convert <wikibase|iiif|media-fragments> <input> [output]",
	);
