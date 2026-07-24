import { describe, expect, test } from "vitest";

import { retryDelayMilliseconds } from "./outbox";

describe("email outbox retry policy", () => {
	test("uses bounded exponential backoff with bounded jitter", () => {
		expect(retryDelayMilliseconds(1, 0)).toBe(5_000);
		expect(retryDelayMilliseconds(2, 0.5)).toBe(10_500);
		expect(retryDelayMilliseconds(20, 1)).toBe(900_999);
	});
});
