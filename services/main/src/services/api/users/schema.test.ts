import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CollectionConfigV1 } from "./schema";

describe("Collection preference contract", () => {
	it("version-controls the Main-with-Variant default", () => {
		expect(
			Check(CollectionConfigV1, {
				version: 1,
				view: "grid",
				addMainWithVariantByDefault: true,
			}),
		).toBe(true);
		expect(Check(CollectionConfigV1, { view: "grid" })).toBe(false);
		expect(Check(CollectionConfigV1, { version: 2 })).toBe(false);
		expect(Check(CollectionConfigV1, { version: 1, unknown: true })).toBe(false);
	});
});
