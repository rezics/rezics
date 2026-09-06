import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const kinds = ["language", "extlang", "script", "region", "variant"] as const;
type Kind = (typeof kinds)[number];
const root = new URL("../", import.meta.url);
const sourcePath = new URL("registry/language-subtag-registry.txt", root);
const generatedPath = new URL("src/iana-registry.generated.ts", root);
const args = process.argv.slice(2);
const update = args[0] === "--update";
if (!(args.length === 1 && args[0] === "--check") && !(update && args.length === 3))
	throw new Error("Use --check or --update <reviewed-registry-file> <expected-sha256>");
const input = await readFile(update ? args[1]! : sourcePath);
if (input.byteLength > 10_000_000) throw new Error("Registry exceeds the reviewed 10 MB bound");
const sha256 = createHash("sha256").update(input).digest("hex");
if (update && args[2]?.toLowerCase() !== sha256) throw new Error("Registry SHA-256 does not match");
const blocks = new TextDecoder("utf-8", { fatal: true }).decode(input).split(/\r?\n%%\r?\n/);
const date = /^File-Date: (\d{4}-\d{2}-\d{2})\s*$/.exec(blocks.shift() ?? "")?.[1];
if (!date || blocks.length > 50_000) throw new Error("Invalid registry date or record bound");
const subtags: Record<Kind, string[]> = {
	language: [],
	extlang: [],
	script: [],
	region: [],
	variant: [],
};
const preferred: Record<string, string> = {};
const extlangPrefixes: Record<string, string[]> = {};
const wholeTags: Record<string, { canonical: string; preferred?: string }> = {};
const privateRanges: { kind: Kind; from: string; to: string }[] = [];
const seen = new Set<string>();
for (const block of blocks) {
	const fields = new Map<string, string[]>();
	let previous: string | undefined;
	for (const line of block.split(/\r?\n/)) {
		if (!line) continue;
		if (/^\s/.test(line) && previous) {
			const values = fields.get(previous)!;
			values[values.length - 1] += ` ${line.trim()}`;
			continue;
		}
		const field = /^([A-Za-z-]+): (.+)$/.exec(line);
		if (!field) throw new Error("Malformed registry field");
		previous = field[1]!;
		fields.set(previous, [...(fields.get(previous) ?? []), field[2]!]);
	}
	const type = fields.get("Type")?.[0];
	const value = fields.get("Subtag")?.[0] ?? fields.get("Tag")?.[0];
	if (!type || !value) throw new Error("Registry record requires a type and tag/subtag");
	const key = value.toLowerCase();
	if (!/^[a-z0-9-]+(?:\.\.[a-z0-9-]+)?$/.test(key) || seen.has(`${type}:${key}`))
		throw new Error("Invalid or duplicate registry identity");
	seen.add(`${type}:${key}`);
	const replacement = fields.get("Preferred-Value")?.[0];
	if (type === "grandfathered" || type === "redundant") {
		wholeTags[key] = { canonical: value, ...(replacement ? { preferred: replacement } : {}) };
		continue;
	}
	const kind = kinds.find((kind) => kind === type);
	if (!kind) throw new Error(`Unreviewed registry type: ${type}`);
	if (key.includes("..")) {
		const [from, to] = key.split("..");
		if (
			!from ||
			!to ||
			from.length !== to.length ||
			from > to ||
			!fields.get("Description")?.includes("Private use")
		)
			throw new Error("Unreviewed registry range");
		privateRanges.push({ kind, from, to });
	} else subtags[kind].push(key);
	if (replacement) preferred[`${kind}:${key}`] = replacement;
	if (kind === "extlang") extlangPrefixes[key] = fields.get("Prefix") ?? [];
}
const data = {
	date,
	sha256,
	recordCount: blocks.length,
	subtags: Object.fromEntries(kinds.map((kind) => [kind, subtags[kind].sort().join(" ")])),
	preferred,
	extlangPrefixes,
	wholeTags,
	privateRanges,
};
const generated =
	`// Generated from the pinned IANA registry by scripts/update-registry.ts. Do not edit.\n` +
	`import type { LanguageRegistry } from "./registry-contract";\n\n` +
	`export const ianaRegistry: LanguageRegistry = ${JSON.stringify(data, null, "\t")};\n`;
const formatter = spawnSync(
	process.execPath,
	[
		createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome"),
		"format",
		"--stdin-file-path",
		fileURLToPath(generatedPath),
	],
	{ input: generated, encoding: "utf8", windowsHide: true, timeout: 10_000, maxBuffer: 10_000_000 },
);
if (formatter.status !== 0)
	throw new Error("Registry formatting failed", { cause: formatter.error });
const formatted = formatter.stdout;
if (update) {
	await mkdir(new URL("registry/", root), { recursive: true });
	await writeFile(sourcePath, input);
	await writeFile(generatedPath, formatted);
} else if ((await readFile(generatedPath, "utf8")) !== formatted) {
	throw new Error("Generated language registry differs from its pinned source");
}
console.info(
	`${update ? "Generated" : "Verified"} IANA ${date}, ${blocks.length} records, SHA-256 ${sha256}, ${fileURLToPath(generatedPath)}`,
);
