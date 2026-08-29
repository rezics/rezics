import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const RepositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const ProductionSourceRoots = [
	join(RepositoryRoot, "apps", "web"),
	join(RepositoryRoot, "libraries", "ui", "src"),
] as const;

function sourceFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory())
			return ["node_modules", ".next", ".vinext", "dist"].includes(entry.name)
				? []
				: sourceFiles(path);
		if (!entry.isFile() || ![".ts", ".tsx"].includes(extname(entry.name))) return [];
		return entry.name.includes(".test.") || entry.name.includes(".spec.") ? [] : [path];
	});
}

describe("reserved Zone-theme class namespace", () => {
	it("is never assigned by platform production source", () => {
		const assignments = ProductionSourceRoots.flatMap(sourceFiles)
			.filter((path) => readFileSync(path, "utf8").includes("rezics-theme-"))
			.map((path) => relative(RepositoryRoot, path).replaceAll("\\", "/"));

		expect(assignments).toEqual([]);
	});
});
