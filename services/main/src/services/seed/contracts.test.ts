import { describe, expect, it } from "vitest";

import {
	createSeedRunOptions,
	includesSeedScenario,
	parseSeedRunOptions,
	SeedScenarioValues,
} from "./contracts";

describe("Seed service contracts", () => {
	it("uses a fixed clock for every reproducible profile", () => {
		const options = createSeedRunOptions({ profile: "coverage" });

		expect(options.referenceTime.toISOString()).toBe("2026-07-15T12:00:00.000Z");
		expect(options.scenarios).toEqual(SeedScenarioValues);
		expect(createSeedRunOptions({ profile: "demo" }).referenceTime).toEqual(
			options.referenceTime,
		);
	});

	it("keeps demo data focused without weakening the coverage profile", () => {
		const demo = createSeedRunOptions({
			profile: "demo",
			referenceTime: new Date("2026-07-24T00:00:00.000Z"),
		});

		expect(includesSeedScenario(demo, "units")).toBe(true);
		expect(includesSeedScenario(demo, "communications")).toBe(false);
		expect(includesSeedScenario(demo, "governance")).toBe(false);
	});

	it("parses only proved CLI values", () => {
		expect(
			parseSeedRunOptions([
				"--profile",
				"coverage",
				"--reference-time",
				"2026-07-20T00:00:00.000Z",
			]),
		).toMatchObject({
			profile: "coverage",
			referenceTime: new Date("2026-07-20T00:00:00.000Z"),
		});
		expect(() => parseSeedRunOptions(["--profile", "unknown"])).toThrow(/Seed profile/);
		expect(() => parseSeedRunOptions(["--reference-time", "not-a-date"])).toThrow(
			/Invalid Seed reference time/,
		);
		expect(() => parseSeedRunOptions(["--unknown"])).toThrow(/Usage/);
	});
});
