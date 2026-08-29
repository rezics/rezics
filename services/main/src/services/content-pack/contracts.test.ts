import { describe, expect, it } from "vitest";

import { parseShowcaseFixtureRunOptions } from "./contracts";

describe("parseShowcaseFixtureRunOptions", () => {
	it("parses apply with an explicit source directory", () => {
		expect(
			parseShowcaseFixtureRunOptions([
				"apply",
				"--from",
				"../rezics-showcase-packs",
				"--pack",
				"toaru-core",
			]),
		).toEqual({
			command: "apply",
			from: "../rezics-showcase-packs",
			packId: "toaru-core",
		});
	});

	it("rejects seed-like extra flags", () => {
		expect(() => parseShowcaseFixtureRunOptions(["apply", "--profile", "demo"])).toThrow(
			/Unknown argument/,
		);
	});
});
