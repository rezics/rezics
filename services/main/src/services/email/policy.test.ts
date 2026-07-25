import { describe, expect, test } from "vitest";

import { emailIntentDeliveryEnabled } from "./policy";

describe("email delivery policy", () => {
	test("allows only account access and recovery email", () => {
		expect(emailIntentDeliveryEnabled("notification")).toBe(false);
		expect(emailIntentDeliveryEnabled("reset_password")).toBe(true);
		expect(emailIntentDeliveryEnabled("verify_email")).toBe(true);
	});
});
