import { describe, expect, it } from "vitest";

import { notificationTranslationKey } from "./service";

describe("notification translation selection", () => {
	it("uses dedicated copy only for a proven access-invitation system event", () => {
		expect(
			notificationTranslationKey("system", {
				type: "system_event",
				event: "unit_access_invitation",
			}),
		).toBe("unit_access_invitation");
		expect(
			notificationTranslationKey("system", {
				type: "system_event",
				event: "another_event",
			}),
		).toBe("system");
		expect(notificationTranslationKey("system", null)).toBe("system");
	});

	it("keeps non-system kinds independent from payload contents", () => {
		expect(
			notificationTranslationKey("reply", {
				type: "system_event",
				event: "unit_access_invitation",
			}),
		).toBe("reply");
	});
});
