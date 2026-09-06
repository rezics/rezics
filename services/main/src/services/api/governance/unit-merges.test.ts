import { describe, expect, it } from "vitest";
import unitMerges from "./unit-merges";

describe("review-only identity merge API", () => {
	it("does not expose the retired direct-acceptance route", async () => {
		const response = await unitMerges.handle(
			new Request("http://localhost/platform/unit-merges/direct", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
		);
		expect(response.status).toBe(404);
	});
});
