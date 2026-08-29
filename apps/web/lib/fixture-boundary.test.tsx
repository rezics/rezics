import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative, sep } from "node:path";
import { FixtureProvider, useFixtureClient } from "@rezics/fixture-client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const FrontendRoot = new URL("../", import.meta.url);
const ProductionLocaleRoot = new URL("../../../libraries/i18n/src/languages/", import.meta.url);
const SourceExtensions = new Set([".ts", ".tsx"]);
const IgnoredDirectories = new Set(["node_modules", ".next", ".vinext", "dist"]);
const FixturePackageSpecifiers = ["@rezics/fixture-client", "@rezics/fixture-data"] as const;
const RepositoryReadBatchSize = 64;
const RepositoryScanTimeoutMs = 30_000;

async function collectSourceFiles(directory: URL): Promise<URL[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry): Promise<URL[]> => {
			if (entry.isDirectory() && IgnoredDirectories.has(entry.name)) return Promise.resolve([]);
			const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
			if (entry.isDirectory()) return collectSourceFiles(path);
			return Promise.resolve(SourceExtensions.has(extname(entry.name)) ? [path] : []);
		}),
	);
	return files.flat();
}

function repoRelativePath(from: string, to: string): string {
	return relative(from, to).split(sep).join("/");
}

function isFixtureDevelopmentSurface(path: URL): boolean {
	const fileName = basename(path.pathname);
	return (
		fileName === "cosmos.decorator.tsx" ||
		fileName.includes(".fixture.") ||
		fileName.includes(".test.")
	);
}

async function findViolations(
	paths: readonly URL[],
	inspect: (path: URL) => Promise<readonly string[]>,
): Promise<string[]> {
	const violations: string[] = [];
	for (let offset = 0; offset < paths.length; offset += RepositoryReadBatchSize) {
		const batchViolations = await Promise.all(
			paths.slice(offset, offset + RepositoryReadBatchSize).map(inspect),
		);
		for (const found of batchViolations) violations.push(...found);
	}
	return violations;
}

function FixtureProbe() {
	const fixture = useFixtureClient();
	return <span data-language={fixture.contentLanguage}>{fixture.feed.attributions[0].name}</span>;
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

	it(
		"keeps fixture packages out of production frontend modules",
		async () => {
			const violations = await findViolations(
				await collectSourceFiles(FrontendRoot),
				async (path) => {
					if (isFixtureDevelopmentSurface(path)) return [];
					const source = await readFile(path, "utf8");
					return FixturePackageSpecifiers.filter((specifier) => source.includes(specifier)).map(
						(specifier) =>
							`${repoRelativePath(FrontendRoot.pathname, path.pathname)} imports ${specifier}`,
					);
				},
			);

			expect(violations).toEqual([]);
		},
		RepositoryScanTimeoutMs,
	);

	it(
		"keeps fixture-only keys out of production locale resources",
		async () => {
			const violations = await findViolations(
				await collectSourceFiles(ProductionLocaleRoot),
				async (path) => {
					const source = await readFile(path, "utf8");
					return /\bfixture\s*:/.test(source)
						? [repoRelativePath(ProductionLocaleRoot.pathname, path.pathname)]
						: [];
				},
			);

			expect(violations).toEqual([]);
		},
		RepositoryScanTimeoutMs,
	);
});
