import { describe, expect, it } from "vitest";

import {
	DefaultScaleSeedBatchSize,
	DefaultScaleSeedDistribution,
	parseScaleSeedOptions,
	scaleSeedTitlePrefix,
} from "./contracts";

describe("scale-seed command contract", () => {
	it("parses a bounded seed run without coupling it to recommendation refresh", () => {
		const options = parseScaleSeedOptions([
			"seed",
			"--run-id",
			"feed-20k",
			"--units",
			"20000",
			"--batch-size",
			"500",
			"--events-per-unit",
			"2",
			"--distribution",
			"book=40,software=35,media=25",
			"--reference-time",
			"2026-08-01T00:00:00.000Z",
			"--yes",
		]);

		expect(options).toMatchObject({
			action: "seed",
			confirmed: true,
			runId: "feed-20k",
			units: 20_000,
			batchSize: 500,
			eventsPerUnit: 2,
			distribution: { book: 40, software: 35, media: 25 },
			referenceTime: new Date("2026-08-01T00:00:00.000Z"),
		});
	});

	it("uses safe defaults and makes purge explicit", () => {
		const seed = parseScaleSeedOptions(["--run-id", "smoke", "--units", "10", "--yes"]);
		expect(seed).toMatchObject({
			action: "seed",
			batchSize: DefaultScaleSeedBatchSize,
			eventsPerUnit: 0,
			distribution: DefaultScaleSeedDistribution,
		});
		expect(parseScaleSeedOptions(["purge", "--run-id", "smoke", "--yes"])).toEqual({
			action: "purge",
			confirmed: true,
			runId: "smoke",
		});
		expect(scaleSeedTitlePrefix("smoke")).toBe("Scale seed [smoke]");
	});

	it("rejects unsafe or incomplete commands", () => {
		expect(() => parseScaleSeedOptions(["seed", "--run-id", "smoke", "--units", "10"])).toThrow(
			/--yes confirmation/,
		);
		expect(() =>
			parseScaleSeedOptions(["seed", "--run-id", "Smoke", "--units", "10", "--yes"]),
		).toThrow(/--run-id/);
		expect(() =>
			parseScaleSeedOptions([
				"seed",
				"--run-id",
				"smoke",
				"--units",
				"10",
				"--distribution",
				"book=50,software=50,media=1",
				"--yes",
			]),
		).toThrow(/add up to 100/);
		expect(() =>
			parseScaleSeedOptions(["purge", "--run-id", "smoke", "--units", "10", "--yes"]),
		).toThrow(/only --run-id and --yes/);
	});
});
