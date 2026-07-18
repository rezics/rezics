import { describe, expect, it } from "vitest";

import { imageAssetContentUrl, imageObjectTracking, imageObjectUploadHeaders } from "./service";

describe("image asset identity", () => {
	it("derives a stable canonical content URL from the asset id", () => {
		expect(imageAssetContentUrl("019f73cb-926e-7e50-9a7f-da67701accb3")).toBe(
			"/image-assets/019f73cb-926e-7e50-9a7f-da67701accb3/content",
		);
	});

	it("keeps uploader identity on the physical storage object", () => {
		const tracking = imageObjectTracking({
			assetId: "asset-id",
			objectId: "object-id",
			uploaderProfileId: "profile-id",
		});
		expect(tracking).toEqual({
			image_asset_id: "asset-id",
			image_object_id: "object-id",
			uploader_profile_id: "profile-id",
		});
		expect(imageObjectUploadHeaders(tracking, "image/png")).toEqual({
			"Content-Type": "image/png",
			"x-amz-meta-image_asset_id": "asset-id",
			"x-amz-meta-image_object_id": "object-id",
			"x-amz-meta-uploader_profile_id": "profile-id",
			"x-amz-tagging":
				"image_asset_id=asset-id&image_object_id=object-id&uploader_profile_id=profile-id",
		});
	});
});
