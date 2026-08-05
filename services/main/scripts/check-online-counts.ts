import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type AllowRule = {
	readonly file: string;
	readonly line: RegExp;
	readonly maximumOccurrences: number;
	readonly reason: string;
};

const allowRules: readonly AllowRule[] = [
	{
		file: "platform-users/service.ts",
		line: /select count\(\*\)::integer/,
		maximumOccurrences: 1,
		reason: "the inner active-session relation is capped by WorkPolicy",
	},
	{
		file: "auth/api-quota/limit-store.ts",
		line: /active: count\(\)/,
		maximumOccurrences: 1,
		reason: "the enforced concurrency policy has a server-owned ceiling",
	},
	{
		file: "api/tokens/index.ts",
		line: /\.select\(\{ active: count\(\) \}\)/,
		maximumOccurrences: 2,
		reason: "the locked active-token inventory has a server-owned ceiling",
	},
	{
		file: "api/posts/reply-tree-query.ts",
		line: /count\(\*\) > \$\{limit\} from anchor_candidates/i,
		maximumOccurrences: 1,
		reason: "anchor_candidates is materialized with the requested limit plus one",
	},
	{
		file: "search/service.ts",
		line: /count\(distinct \$\{unit\.id\}\)/,
		maximumOccurrences: 2,
		reason: "facet input is the server-capped search_candidate relation",
	},
	{
		file: "recommendations/worker.ts",
		line: /count\(\*\) OVER \(\) AS peer_count/,
		maximumOccurrences: 1,
		reason: "the lateral peer relation is capped at structural degree plus one",
	},
	{
		file: "recommendations/worker.ts",
		line: /count\(\*\) FILTER \(WHERE type =/,
		maximumOccurrences: 4,
		reason: "the offline daily metrics worker scans a fixed two-day window",
	},
	{
		file: "studio/projection.ts",
		line: /count\(\*\)::integer/,
		maximumOccurrences: 5,
		reason: "the explicitly rebuildable Studio projection runs off the request path",
	},
];

const serviceRoot = resolve(fileURLToPath(new URL("../src/services", import.meta.url)));
const offlineDirectoryPrefixes = ["bootstrap/", "seed/"] as const;
const countCall = /\bcount\s*\(/i;

async function listTypeScriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listTypeScriptFiles(path)));
		else if (extname(entry.name) === ".ts" && !entry.name.endsWith(".test.ts"))
			files.push(path);
	}
	return files;
}

const usage = new Map<AllowRule, number>(allowRules.map((rule) => [rule, 0]));
const violations: string[] = [];
for (const path of await listTypeScriptFiles(serviceRoot)) {
	const file = relative(serviceRoot, path);
	if (offlineDirectoryPrefixes.some((prefix) => file.startsWith(prefix))) continue;
	const lines = (await readFile(path, "utf8")).split("\n");
	for (const [offset, line] of lines.entries()) {
		if (!countCall.test(line)) continue;
		const rule = allowRules.find(
			(candidate) => candidate.file === file && candidate.line.test(line),
		);
		if (!rule) {
			violations.push(`${file}:${offset + 1}: ${line.trim()}`);
			continue;
		}
		usage.set(rule, (usage.get(rule) ?? 0) + 1);
	}
}

for (const rule of allowRules) {
	const occurrences = usage.get(rule) ?? 0;
	if (occurrences < 1 || occurrences > rule.maximumOccurrences)
		violations.push(
			`${rule.file}: allowlist expected 1-${rule.maximumOccurrences} occurrence(s), found ${occurrences} (${rule.reason})`,
		);
}

if (violations.length)
	throw new Error(`Online exact-count policy violations:\n${violations.join("\n")}`);
console.info(`Online exact-count policy passed (${allowRules.length} bounded/offline rules)`);
