import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { QueryClientDefaultOptions, shouldRetryQuery } from "./query-policy";

describe("query retry policy", () => {
	it("retries only the first network or transient gateway failure", () => {
		expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
		expect(shouldRetryQuery(1, new Error("network"))).toBe(false);
		expect(
			shouldRetryQuery(
				0,
				Object.assign(new Error("bad request"), {
					status: StatusCodes.UNPROCESSABLE_ENTITY,
				}),
			),
		).toBe(false);
		expect(
			shouldRetryQuery(
				0,
				Object.assign(new Error("unavailable"), {
					status: StatusCodes.SERVICE_UNAVAILABLE,
				}),
			),
		).toBe(true);
		expect(
			shouldRetryQuery(
				0,
				Object.assign(new Error("internal"), {
					status: StatusCodes.INTERNAL_SERVER_ERROR,
				}),
			),
		).toBe(false);
		expect(
			shouldRetryQuery(
				0,
				Object.assign(new Error("rate limited"), {
					status: StatusCodes.TOO_MANY_REQUESTS,
				}),
			),
		).toBe(false);
	});

	it("never retries mutations unless an operation explicitly opts in", () => {
		expect(QueryClientDefaultOptions.mutations.retry).toBe(false);
	});
});
