import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const localComponentsDirectory = path.join(repositoryRoot, "libraries/ui/src/ui");
const upstreamComponentsDirectory = path.join(
	repositoryRoot,
	"references/shark-ui/registry/react/components",
);
const SourceDirectories = [
	path.join(repositoryRoot, "frontend"),
	path.join(repositoryRoot, "libraries/ui/src/custom"),
];
const projectOwnedOverrides = new Map([
	["button", "./custom/button"],
	["card", "./custom/card"],
	["menu", "./custom/menu"],
]);

async function getComponentNames(directory) {
	return (await readdir(directory))
		.filter((file) => file.endsWith(".tsx"))
		.map((file) => file.slice(0, -".tsx".length))
		.sort();
}

async function findSourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return findSourceFiles(entryPath);
			return entry.isFile() && entryPath.endsWith(".tsx") ? [entryPath] : [];
		}),
	);
	return files.flat().sort();
}

function getMissingItems(expected, actual) {
	const actualSet = new Set(actual);
	return expected.filter((item) => !actualSet.has(item));
}

function getRelativePath(file) {
	return path.relative(repositoryRoot, file).replaceAll(path.sep, "/");
}

function findLocations(file, source, expression) {
	const findings = [];
	for (const match of source.matchAll(expression)) {
		const before = source.slice(0, match.index);
		findings.push(`${getRelativePath(file)}:${before.split("\n").length}: ${match[0]}`);
	}
	return findings;
}

const [
	localComponents,
	upstreamComponents,
	indexSource,
	packageSource,
	registrySource,
	...uiSources
] = await Promise.all([
	getComponentNames(localComponentsDirectory),
	getComponentNames(upstreamComponentsDirectory),
	readFile(path.join(repositoryRoot, "libraries/ui/src/index.ts"), "utf8"),
	readFile(path.join(repositoryRoot, "libraries/ui/package.json"), "utf8"),
	readFile(path.join(repositoryRoot, "libraries/ui/components.json"), "utf8"),
	...SourceDirectories.map(findSourceFiles),
]);

const failures = [];
const missingLocalComponents = getMissingItems(upstreamComponents, localComponents);
const unexpectedLocalComponents = getMissingItems(localComponents, upstreamComponents);
if (missingLocalComponents.length || unexpectedLocalComponents.length) {
	failures.push(
		[
			"SharkUI component mirror differs from the checked-in upstream registry.",
			...(missingLocalComponents.length
				? [`Missing locally: ${missingLocalComponents.join(", ")}`]
				: []),
			...(unexpectedLocalComponents.length
				? [`Not in upstream registry: ${unexpectedLocalComponents.join(", ")}`]
				: []),
		].join("\n"),
	);
}

const missingExports = localComponents.filter((component) => {
	const exportPath = projectOwnedOverrides.get(component) ?? `./ui/${component}`;
	return !indexSource.includes(`export * from "${exportPath}";`);
});
if (missingExports.length) {
	failures.push(`SharkUI components missing package-root exports: ${missingExports.join(", ")}`);
}

const registry = JSON.parse(registrySource);
if (registry.registries?.["@shark"] !== "https://shark.vini.one/r/{name}.json") {
	failures.push("components.json must retain the official @shark registry URL.");
}

const packageManifest = JSON.parse(packageSource);
if ("./*" in packageManifest.exports || "./ui/*" in packageManifest.exports) {
	failures.push("Upstream SharkUI internals must not be exposed as public package subpaths.");
}

const SourcePolicies = [
	{
		name: "native UI controls",
		expression: /<\s*(?:button|input|textarea|select|option|dialog|hr|table|progress)\b/gu,
	},
	{
		name: "hand-built ARIA composite widgets",
		expression: /role=["'](?:listbox|option|menu|dialog|alertdialog)["']/giu,
	},
	{
		name: "Tailwind space-x/space-y layout utilities",
		expression: /\bspace-[xy]-/gu,
	},
	{
		name: "physical-direction Tailwind utilities",
		expression: /\b(?:ml|mr|pl|pr|left|right)-/gu,
	},
	{
		name: "raw Tailwind palette utilities",
		expression:
			/\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-/gu,
	},
];

for (const file of uiSources.flat()) {
	const source = await readFile(file, "utf8");
	for (const policy of SourcePolicies) {
		const findings = findLocations(file, source, policy.expression);
		if (findings.length) failures.push(`${policy.name}:\n${findings.join("\n")}`);
	}
}

if (failures.length) {
	console.error("SharkUI audit failed.\n");
	console.error(failures.join("\n\n"));
	process.exitCode = 1;
} else {
	console.log(
		`SharkUI audit passed: ${upstreamComponents.length} upstream components mirrored and exported; ${uiSources.flat().length} application UI sources satisfy the shared component rules.`,
	);
}
