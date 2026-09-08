import { expect, it } from "vitest";
import { isUnitType } from "./unit-types";
it.each(["audio", "video"])("admits the concrete %s platform owner", (owner) => {
	expect(isUnitType(owner)).toBe(true);
});
it.each(["book", "media", "series", "release", "software", "publishing"])(
	"does not substitute %s for timed media",
	(owner) => {
		expect(isUnitType(owner)).toBe(false);
	},
);
