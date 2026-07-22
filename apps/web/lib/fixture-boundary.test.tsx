import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative } from "node:path";
import { FixtureProvider, useFixtureClient } from "@rezics/fixture-client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const FrontendRoot = new URL("../", import.meta.url);
const ProductionLocaleRoot = new URL("../../../libraries/i18n/src/languages/", import.meta.url);
const SourceExtensions = new Set([".ts", ".tsx"]);
const IgnoredDirectories = new Set(["node_modules", ".next", ".vinext", "dist"]);
const FixturePackageSpecifiers = ["@rezics/fixture-client", "@rezics/fixture-data"] as const;

async function collectSourceFiles(directory: URL): Promise<URL[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry): Promise<URL[]> => {
			if (entry.isDirectory() && IgnoredDirectories.has(entry.name))
				return Promise.resolve([]);
			const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
			if (entry.isDirectory()) return collectSourceFiles(path);
			return Promise.resolve(SourceExtensions.has(extname(entry.name)) ? [path] : []);
		}),
	);
	return files.flat();
}

function isFixtureDevelopmentSurface(path: URL): boolean {
	const fileName = basename(path.pathname);
	return (
		fileName === "cosmos.decorator.tsx" ||
		fileName.includes(".fixture.") ||
		fileName.includes(".test.")
	);
}

function FixtureProbe() {
	const fixture = useFixtureClient();
	return <span data-language={fixture.contentLanguage}>{fixture.feed.publishers[0].name}</span>;
}

describe("fixture package boundaries", () => {
	it("selects localized fixture data through the shared client provider", () => {
		const markup = renderToStaticMarkup(
			<FixtureProvider contentLanguage="en">
				<FixtureProbe />
			</FixtureProvider>,
		);

		expect(markup).toContain('data-language="en"');
		expect(markup).toContain("Dolphin Reading Club");
	});

	it("rejects fixture hooks outside their provider", () => {
		expect(() => renderToStaticMarkup(<FixtureProbe />)).toThrow(
			"useFixtureClient must be used within FixtureProvider.",
		);
	});

	it("keeps fixture packages out of production frontend modules", async () => {
		const violations: string[] = [];
		for (const path of await collectSourceFiles(FrontendRoot)) {
			if (isFixtureDevelopmentSurface(path)) continue;
			const source = await readFile(path, "utf8");
			for (const specifier of FixturePackageSpecifiers) {
				if (source.includes(specifier)) {
					violations.push(
						`${relative(FrontendRoot.pathname, path.pathname)} imports ${specifier}`,
					);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it("keeps fixture-only keys out of production locale resources", async () => {
		const violations: string[] = [];
		for (const path of await collectSourceFiles(ProductionLocaleRoot)) {
			const source = await readFile(path, "utf8");
			if (/\bfixture\s*:/.test(source)) {
				violations.push(relative(ProductionLocaleRoot.pathname, path.pathname));
			}
		}

		expect(violations).toEqual([]);
	});
});
