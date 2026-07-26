import { describe, expect, it } from "vitest";

import { clampNormalizedImageCrop, defaultNormalizedImageCrop } from "./image-asset-presentation";

describe("ImageAsset presentation model", () => {
	it("centers avatar crops and top-left anchors banner crops", () => {
		expect(defaultNormalizedImageCrop("avatar", 1600, 900)).toEqual({
			x: 0.21875,
			y: 0,
			width: 0.5625,
			height: 1,
		});
		expect(defaultNormalizedImageCrop("banner", 1200, 1600)).toEqual({
			x: 0,
			y: 0,
			width: 1,
			height: 0.1875,
		});
	});

	it("keeps panned crops inside the original image", () => {
		expect(clampNormalizedImageCrop({ x: -0.5, y: 0.9, width: 0.5, height: 0.25 })).toEqual({
			x: 0,
			y: 0.75,
			width: 0.5,
			height: 0.25,
		});
	});
});
