import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as publicSchemas from "./music-api-contracts";

describe("native music HTTP schema export", () => {
	it("can publish every public input and response as JSON Schema", () => {
		for (const [name, schema] of Object.entries(publicSchemas)) {
			expect(() => z.toJSONSchema(schema), name).not.toThrow();
		}
	});
	it("keeps omitted foreign references absent from a partial track patch", () => {
		const input = publicSchemas.MusicEditTrackSchema.parse({
			expectedRevision: 1,
			expectedHeadId: "019b2e31-9810-7000-8000-000000000001",
			value: { name: "Corrected printed name" },
		});
		expect(input.value).not.toHaveProperty("recordingId");
		expect(input.value).not.toHaveProperty("artistCreditId");
		expect(publicSchemas.MusicEditTrackSchema.safeParse({ ...input, value: {} }).success).toBe(
			false,
		);
	});
});
