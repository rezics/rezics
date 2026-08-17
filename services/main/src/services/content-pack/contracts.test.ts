import { describe, expect, it } from "vitest";

import { parseContentPackRunOptions } from "./contracts";

describe("parseContentPackRunOptions", () => {
	it("parses apply with an explicit source directory", () => {
		expect(parseContentPackRunOptions(["apply", "--from", "../rezics-showcase-packs", "--pack", "toaru-core"])).toEqual({
			command: "apply",
			from: "../rezics-showcase-packs",
			packId: "toaru-core",
		});
	});

	it("rejects seed-like extra flags", () => {
		expect(() => parseContentPackRunOptions(["apply", "--profile", "demo"])).toThrow(/Unknown argument/);
	});
});
