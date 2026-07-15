import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { shouldRetry } from "./query-policy";

describe("query retry policy", () => {
	it("retries only the first network or server failure", () => {
		expect(shouldRetry(0, new Error("network"))).toBe(true);
		expect(shouldRetry(1, new Error("network"))).toBe(false);
		expect(
			shouldRetry(
				0,
				Object.assign(new Error("bad request"), {
					status: StatusCodes.UNPROCESSABLE_ENTITY,
				}),
			),
		).toBe(false);
		expect(
			shouldRetry(
				0,
				Object.assign(new Error("unavailable"), {
					status: StatusCodes.SERVICE_UNAVAILABLE,
				}),
			),
		).toBe(true);
	});
});
