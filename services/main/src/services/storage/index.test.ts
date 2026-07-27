import { describe, expect, it } from "vitest";

import { storage } from ".";

describe("R2-compatible storage requests", () => {
	it("presigns uploads with protected metadata and no optional checksum parameters", async () => {
		const signedUrl = new URL(
			await storage.presignPut({
				Key: "image-objects/asset-id/original",
				ContentLength: 5,
				ContentType: "image/png",
				Metadata: {
					image_asset_id: "asset-id",
					image_object_id: "object-id",
					uploader_profile_id: "profile-id",
				},
			}),
		);
		const signedHeaders = signedUrl.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];

		expect(signedHeaders).toEqual(
			expect.arrayContaining([
				"x-amz-meta-image_asset_id",
				"x-amz-meta-image_object_id",
				"x-amz-meta-uploader_profile_id",
			]),
		);
		expect(signedHeaders).not.toContain("x-amz-tagging");
		expect(signedUrl.searchParams.has("x-amz-checksum-crc32")).toBe(false);
		expect(signedUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
	});
});
