import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	decodeCollectionItemsCursor,
	encodeCollectionItemsCursor,
	type CollectionItemsCursorScope,
} from "../src/services/api/collections/items-cursor";
const scope: CollectionItemsCursorScope = {
	collectionId: "019b0000-0000-7000-8000-000000000001",
	revisionId: "019b0000-0000-7000-8000-000000000002",
	authorization: { profileId: undefined },
	localizationLanguages: ["en"],
};
const boundary = { position: "a0", targetId: "019b0000-0000-7000-8000-000000000003" };
const mode = process.argv[2];
if (mode === "encode") process.stdout.write(encodeCollectionItemsCursor(boundary, scope));
else if (mode === "decode") {
	assert.deepEqual(decodeCollectionItemsCursor(readFileSync(0, "utf8"), scope), boundary);
	process.stdout.write("verified");
} else {
	const path = fileURLToPath(import.meta.url),
		nodeToken = encodeCollectionItemsCursor(boundary, scope);
	const bunVersion = execFileSync("bun", ["--version"], { encoding: "utf8" }).trim();
	assert.equal(
		execFileSync("bun", [path, "decode"], { input: nodeToken, encoding: "utf8", env: process.env }),
		"verified",
	);
	const bunToken = execFileSync("bun", [path, "encode"], { encoding: "utf8", env: process.env });
	assert.deepEqual(decodeCollectionItemsCursor(bunToken, scope), boundary);
	const start = performance.now();
	for (let index = 0; index < 10000; index++)
		assert.deepEqual(
			decodeCollectionItemsCursor(encodeCollectionItemsCursor(boundary, scope), scope),
			boundary,
		);
	console.info(
		JSON.stringify({
			node: process.version,
			bun: bunVersion,
			crossRuntimeChecks: 2,
			roundTrips: 10000,
			elapsedMs: performance.now() - start,
			tokenBytes: nodeToken.length,
		}),
	);
}
