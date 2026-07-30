import { describe, expect, it } from "vitest";

import { joinRealmPinsWithContent } from "./realm-pin-items";

describe("Realm pin content joining", () => {
	it("uses Unit identity rather than response-array position", () => {
		const pins = [
			{ unitId: "unit-a", position: "a0" },
			{ unitId: "unit-b", position: "a1" },
			{ unitId: "unit-c", position: "a2" },
		] as const;
		const content = [
			{ id: "unit-b", title: "Second" },
			{ id: "unit-a", title: "First" },
		] as const;

		expect(joinRealmPinsWithContent(pins, content)).toEqual([
			{ pin: pins[0], content: content[1] },
			{ pin: pins[1], content: content[0] },
			{ pin: pins[2], content: undefined },
		]);
	});
});
