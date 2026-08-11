import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import deState from "../../../libraries/i18n/src/languages/de/state.ts";
import enState from "../../../libraries/i18n/src/languages/en/state.ts";
import esState from "../../../libraries/i18n/src/languages/es/state.ts";
import frState from "../../../libraries/i18n/src/languages/fr/state.ts";
import jaState from "../../../libraries/i18n/src/languages/ja/state.ts";
import koState from "../../../libraries/i18n/src/languages/ko/state.ts";
import zhHansState from "../../../libraries/i18n/src/languages/zh-Hans/state.ts";
import zhHantState from "../../../libraries/i18n/src/languages/zh-Hant/state.ts";
import { formatWithBiome } from "./format-with-biome.ts";

const messages = {
	de: deState.offlinePage,
	en: enState.offlinePage,
	es: esState.offlinePage,
	fr: frState.offlinePage,
	ja: jaState.offlinePage,
	ko: koState.offlinePage,
	"zh-Hans": zhHansState.offlinePage,
	"zh-Hant": zhHantState.offlinePage,
};

const serializedMessages = JSON.stringify(messages).replaceAll("<", "\\u003c");
const serializedBrandName = JSON.stringify(verbatimTerms.rezics.value);
const outputPath = fileURLToPath(new URL("../public/offline.html", import.meta.url));

type GenerationMode = "check" | "write";

function parseGenerationMode(args: readonly string[]): GenerationMode {
	if (args.length === 0) return "write";
	if (args.length === 1 && args[0] === "--check") return "check";
	throw new Error("Usage: generate-offline-page.ts [--check]");
}

const generationMode = parseGenerationMode(process.argv.slice(2));

const html = `<!doctype html>
<html lang="zh-Hant">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#0E1113" media="(prefers-color-scheme: dark)" />
		<meta name="color-scheme" content="light dark" />
		<title></title>
		<style>
			:root {
				font-family: Inter, ui-sans-serif, system-ui, sans-serif;
				color: #181c1f;
				background: #ffffff;
			}
			:root:lang(zh-Hans) {
				font-family: Inter, "Noto Sans CJK SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif;
			}
			:root:lang(zh-Hant) {
				font-family: Inter, "Noto Sans CJK TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif;
			}
			:root:lang(ja) {
				font-family: Inter, "Noto Sans CJK JP", "Yu Gothic", ui-sans-serif, system-ui, sans-serif;
			}
			:root:lang(ko) {
				font-family: Inter, "Noto Sans CJK KR", "Malgun Gothic", ui-sans-serif, system-ui, sans-serif;
			}
			body {
				min-height: 100svh;
				margin: 0;
				display: grid;
				place-items: center;
				padding: max(1.5rem, env(safe-area-inset-top))
					max(1.5rem, env(safe-area-inset-right)) max(1.5rem, env(safe-area-inset-bottom))
					max(1.5rem, env(safe-area-inset-left));
				box-sizing: border-box;
			}
			main {
				width: min(100%, 28rem);
				text-align: center;
			}
			img {
				width: 5rem;
				height: 5rem;
				border-radius: 0.75rem;
			}
			h1 {
				margin: 1.5rem 0 0.5rem;
				font-size: 1.5rem;
				font-family: ui-serif, serif;
			}
			p {
				margin: 0;
				color: #5c6c74;
				line-height: 1.65;
			}
			a {
				display: inline-flex;
				margin-top: 1.5rem;
				padding: 0.65rem 1rem;
				border-radius: 0.5rem;
				color: #000000;
				background: #d8404c;
				font-weight: 650;
				text-decoration: none;
			}
			@media (prefers-color-scheme: dark) {
				:root {
					color: #eef1f3;
					background: #0e1113;
				}
				p {
					color: #8ba2ad;
				}
			}
		</style>
	</head>
	<body>
		<main>
			<img src="/icons/pwa-192x192.png" alt="" />
			<h1 id="heading"></h1>
			<p id="description"></p>
			<a href="/" id="retry"></a>
		</main>
		<script>
			const messages = ${serializedMessages};
			const requested = [...(navigator.languages || []), navigator.language || ""];
			const match = requested.map((value) => {
				try {
					const locale = new Intl.Locale(value.replaceAll("_", "-"));
					if (locale.language === "zh") {
						if (locale.script === "Hant" || ["TW", "HK", "MO"].includes(locale.region)) return "zh-Hant";
						if (locale.script === "Hans" || ["CN", "SG"].includes(locale.region)) return "zh-Hans";
						return "zh-Hant";
					}
					return Object.hasOwn(messages, locale.language) ? locale.language : undefined;
				} catch {
					return undefined;
				}
			}).find(Boolean) || "zh-Hant";
			const copy = messages[match];
			document.documentElement.lang = match;
			document.title = copy.title + " · " + ${serializedBrandName};
			document.getElementById("heading").textContent = copy.heading;
			document.getElementById("description").textContent = copy.description;
			document.getElementById("retry").textContent = copy.retry;
		</script>
	</body>
</html>
`;

const formattedHtml = await formatWithBiome(html, outputPath);

if (generationMode === "check") {
	const currentHtml = await readFile(outputPath, "utf8");
	if (currentHtml !== formattedHtml)
		throw new Error(`${outputPath} is stale; run yarn workspace @rezics/frontend generate:offline`);
} else {
	await writeFile(outputPath, formattedHtml);
}
