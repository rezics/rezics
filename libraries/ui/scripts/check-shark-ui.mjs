import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const localComponentsDirectory = path.join(repositoryRoot, "libraries/ui/src/ui");
const upstreamComponentsDirectory = path.join(
	repositoryRoot,
	"references/shark-ui/registry/react/components",
);
const upstreamManifestUrl = "https://shark.vini.one/r/ui.json";
const SourceDirectories = [
	path.join(repositoryRoot, "apps/web/features"),
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

async function readRegistryItem(url, label) {
	let response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	} catch (error) {
		throw new Error(`Unable to fetch ${label} from ${url}.`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`Unable to fetch ${label} from ${url}: HTTP ${response.status}.`);
	}
	const value = await response.json();
	if (!value || typeof value !== "object") {
		throw new Error(`${label} from ${url} is not a JSON object.`);
	}
	return value;
}

function getRegistryItemName(dependency) {
	if (typeof dependency !== "string") {
		throw new Error("The SharkUI manifest contains a non-string registry dependency.");
	}
	const file = path.posix.basename(new URL(dependency).pathname);
	if (!file.endsWith(".json")) {
		throw new Error(`The SharkUI registry dependency has no JSON item name: ${dependency}`);
	}
	return file.slice(0, -".json".length);
}

function registryItemHasComponentSource(item) {
	return (
		Array.isArray(item.files) &&
		item.files.some(
			(file) =>
				file &&
				typeof file === "object" &&
				typeof file.path === "string" &&
				file.path.endsWith(".tsx"),
		)
	);
}

async function getUpstreamComponents(localComponents) {
	try {
		return {
			components: await getComponentNames(upstreamComponentsDirectory),
			source: getRelativePath(upstreamComponentsDirectory),
		};
	} catch (error) {
		if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
	}

	const manifest = await readRegistryItem(upstreamManifestUrl, "SharkUI UI manifest");
	if (!Array.isArray(manifest.registryDependencies)) {
		throw new Error("The SharkUI UI manifest has no registryDependencies array.");
	}
	const dependencyByName = new Map(
		manifest.registryDependencies.map((dependency) => [
			getRegistryItemName(dependency),
			dependency,
		]),
	);
	const candidates = [...dependencyByName.keys()].sort();
	const missingCandidates = getMissingItems(candidates, localComponents);
	const componentMissingCandidates = new Set(
		(
			await Promise.all(
				missingCandidates.map(async (name) => {
					const dependency = dependencyByName.get(name);
					if (!dependency) throw new Error(`Missing registry dependency for ${name}.`);
					const item = await readRegistryItem(
						dependency,
						`SharkUI registry item ${name}`,
					);
					return registryItemHasComponentSource(item) ? name : undefined;
				}),
			)
		).filter(Boolean),
	);
	return {
		components: candidates.filter(
			(name) => localComponents.includes(name) || componentMissingCandidates.has(name),
		),
		source: upstreamManifestUrl,
	};
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

const localComponents = await getComponentNames(localComponentsDirectory);
const upstream = await getUpstreamComponents(localComponents);
const [indexSource, packageSource, registrySource, ...uiSources] = await Promise.all([
	readFile(path.join(repositoryRoot, "libraries/ui/src/index.ts"), "utf8"),
	readFile(path.join(repositoryRoot, "libraries/ui/package.json"), "utf8"),
	readFile(path.join(repositoryRoot, "libraries/ui/components.json"), "utf8"),
	...SourceDirectories.map(findSourceFiles),
]);
const upstreamComponents = upstream.components;

const failures = [];
const missingLocalComponents = getMissingItems(upstreamComponents, localComponents);
const unexpectedLocalComponents = getMissingItems(localComponents, upstreamComponents);
if (missingLocalComponents.length || unexpectedLocalComponents.length) {
	failures.push(
		[
			"SharkUI component mirror differs from the upstream registry.",
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
		name: "feature-level control radius overrides",
		expression:
			/<(?:Button|ChoiceSelect|InputGroup|SelectTrigger)\b[^>]*\brounded-(?:none|sm|md|lg|xl|2xl|3xl|4xl|full)\b/gsu,
	},
	{
		name: "Tailwind space-x/space-y layout utilities",
		expression: /\bspace-[xy]-/gu,
	},
	{
		name: "physical-direction Tailwind utilities",
		expression: /\b(?:ml|mr|pl|pr|left|right)-(?:\d|px\b|auto\b|full\b|\[)/gu,
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
		`SharkUI audit passed against ${upstream.source}: ${upstreamComponents.length} upstream components mirrored and exported; ${uiSources.flat().length} application UI sources satisfy the shared component rules.`,
	);
}
