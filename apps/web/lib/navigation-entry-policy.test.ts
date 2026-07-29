import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const FeatureRoot = fileURLToPath(new URL("../features/", import.meta.url));
const SourceExtensions = new Set([".ts", ".tsx"]);
const IgnoredDirectories = new Set(["node_modules", ".next", ".vinext", "dist"]);
const FrameworkLinkOwner = "application-shell/components/app-link.tsx";
const FrameworkRouterOwner = "application-shell/hooks/use-application-router.ts";

async function collectSourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry): Promise<string[]> => {
			const path = resolve(directory, entry.name);
			if (entry.isDirectory())
				return IgnoredDirectories.has(entry.name)
					? Promise.resolve([])
					: collectSourceFiles(path);
			if (!SourceExtensions.has(extname(entry.name)) || entry.name.includes(".test."))
				return Promise.resolve([]);
			return Promise.resolve([path]);
		}),
	);
	return files.flat();
}

describe("application navigation entry policy", () => {
	it("keeps framework Link and Router lifecycle access behind application-shell owners", async () => {
		const violations: string[] = [];

		for (const path of await collectSourceFiles(FeatureRoot)) {
			const featurePath = relative(FeatureRoot, path);
			const source = await readFile(path, "utf8");
			if (source.includes('from "next/link"') && featurePath !== FrameworkLinkOwner)
				violations.push(`${featurePath} imports next/link`);
			if (
				/import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*"next\/navigation"/s.test(source) &&
				featurePath !== FrameworkRouterOwner
			)
				violations.push(`${featurePath} imports useRouter`);
		}

		expect(violations).toEqual([]);
	});
});
