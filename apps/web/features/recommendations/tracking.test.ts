import { beforeEach, describe, expect, it, vi } from "vitest";

const postEvents = vi.hoisted(() => vi.fn());

vi.mock("@rezics/openapi-tanstack-query", () => ({
	postApiRecommendationsEvents: postEvents,
}));

import { recordRecommendationEvent } from "./tracking";

const tracking = {
	requestId: "00000000-0000-7000-8000-000000000001",
	surface: "home_feed" as const,
	position: "3",
	policyVersion: "hybrid_v1",
	signature: "a".repeat(43),
};

describe("recommendation event recording", () => {
	beforeEach(() => postEvents.mockReset().mockResolvedValue({}));

	it("deduplicates each event type within a recommendation request", () => {
		recordRecommendationEvent("00000000-0000-7000-8000-000000000101", tracking, "impression");
		recordRecommendationEvent("00000000-0000-7000-8000-000000000101", tracking, "impression");
		recordRecommendationEvent("00000000-0000-7000-8000-000000000101", tracking, "open");

		expect(postEvents).toHaveBeenCalledTimes(2);
		expect(postEvents).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				body: expect.objectContaining({
					events: [
						expect.objectContaining({
							type: "impression",
							position: 3,
						}),
					],
				}),
			}),
		);
	});

	it("allows a retry after transport failure", async () => {
		postEvents.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
		const target = "00000000-0000-7000-8000-000000000102";
		recordRecommendationEvent(target, tracking, "dwell_30s");
		await Promise.resolve();
		recordRecommendationEvent(target, tracking, "dwell_30s");

		expect(postEvents).toHaveBeenCalledTimes(2);
		expect(postEvents.mock.calls[1]?.[0].body.events[0].id).toBe(
			postEvents.mock.calls[0]?.[0].body.events[0].id,
		);
	});
});
