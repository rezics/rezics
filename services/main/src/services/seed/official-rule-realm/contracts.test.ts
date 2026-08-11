import { describe, expect, it } from "vitest";

import { parseOfficialRuleSeedOptions } from "./contracts";

describe("official Rule Realm Seed options", () => {
	it("requires explicit confirmation", () => {
		expect(() => parseOfficialRuleSeedOptions([])).toThrow(/--yes/);
	});

	it("supports an idempotent initial-install mode", () => {
		expect(parseOfficialRuleSeedOptions(["--yes"])).toEqual({ whenSeeded: "fail" });
		expect(parseOfficialRuleSeedOptions(["--yes", "--if-needed"])).toEqual({
			whenSeeded: "skip",
		});
	});

	it("rejects repeated and unknown flags", () => {
		expect(() => parseOfficialRuleSeedOptions(["--yes", "--yes"])).toThrow(/repeated/);
		expect(() => parseOfficialRuleSeedOptions(["--yes", "--unknown"])).toThrow(/Usage/);
	});
});
