import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { deTerminology } from "@rezics/i18n/terminology/de";
import { enTerminology } from "@rezics/i18n/terminology/en";
import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { koTerminology } from "@rezics/i18n/terminology/ko";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "../src/verbatim-terms.ts";
import {
	checkMarkdownSource,
	checkTerminologyRegistry,
	checkTypeScriptSource,
	flattenTerminology,
	localeForLocalizationPath,
} from "./localization-policy.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");
const sourceRoots = [
	resolve(packageRoot, "src/languages/en"),
	resolve(packageRoot, "src/languages/zh-Hant"),
	resolve(repositoryRoot, "libraries/fixture-data/src/languages/en"),
	resolve(repositoryRoot, "libraries/fixture-data/src/languages/zh-Hant"),
	...["de", "en", "ja", "ko", "zh-hans", "zh-hant"].map((locale) =>
		resolve(repositoryRoot, `apps/about/src/content/locales/${locale}`),
	),
];
const sourceExtensions = new Set([".ts", ".tsx", ".md", ".mdx"]);
const terminologyByLocale = {
	de: deTerminology,
	en: enTerminology,
	ja: jaTerminology,
	ko: koTerminology,
	"zh-Hans": zhHansTerminology,
	"zh-Hant": zhHantTerminology,
};
const verbatimDefinitions = Object.entries(verbatimTerms)
	.map(([key, definition]) => ({ key, ...definition }))
	.toSorted((left, right) => right.value.length - left.value.length);
const errors = checkTerminologyRegistry(terminologyByLocale);

async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory() ? collectFiles(path) : path;
		}),
	);
	return files.flat().filter((path) => sourceExtensions.has(extname(path)));
}

function definitionsForPath(path) {
	return verbatimDefinitions.filter((definition) =>
		definition.scope === "about" ? path.includes("/apps/about/") : true,
	);
}

for (const path of (await Promise.all(sourceRoots.map(collectFiles))).flat().toSorted()) {
	const locale = localeForLocalizationPath(path);
	if (!locale) {
		errors.push(`${relative(repositoryRoot, path)}: unable to determine localization locale`);
		continue;
	}
	const source = await readFile(path, "utf8");
	const common = {
		path: relative(repositoryRoot, path),
		source,
		verbatimDefinitions: definitionsForPath(path),
		terminologyDefinitions: flattenTerminology(terminologyByLocale[locale]),
		rejectUnapprovedTokens: locale === "zh-Hant",
	};
	if (path.endsWith(".ts") || path.endsWith(".tsx"))
		errors.push(...checkTypeScriptSource(common));
	else errors.push(...checkMarkdownSource(common));
}

if (errors.length > 0) {
	console.error("Localization policy violations:\n");
	console.error(errors.map((error) => `- ${error}`).join("\n"));
	process.exitCode = 1;
}
