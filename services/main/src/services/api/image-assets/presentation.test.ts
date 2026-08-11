import { describe, expect, it } from "vitest";

import { ImageAssetInvalidPresentation } from "./errors";
import {
	defaultImageAssetCrop,
	defaultImageAssetPresentation,
	validateImageAssetPresentation,
} from "./presentation";

describe("image asset presentation policy", () => {
	it("centers the default avatar square", () => {
		expect(defaultImageAssetCrop("avatar", 1600, 900)).toEqual({
			x: 0.21875,
			y: 0,
			width: 0.5625,
			height: 1,
		});
	});

	it("anchors the default banner crop at the top-left", () => {
		expect(defaultImageAssetCrop("banner", 1200, 1600)).toEqual({
			x: 0,
			y: 0,
			width: 1,
			height: 0.1875,
		});
	});

	it("uses contain as the default cover policy", () => {
		expect(defaultImageAssetPresentation("cover", 1600, 900)).toEqual({
			fit: "contain",
		});
	});

	it("rejects contain for fixed-crop roles", () => {
		expect(() => validateImageAssetPresentation("banner", 1200, 1600, { fit: "contain" })).toThrow(
			ImageAssetInvalidPresentation,
		);
	});

	it("rejects a crop whose effective pixel aspect does not match the role", () => {
		expect(() =>
			validateImageAssetPresentation("avatar", 1600, 900, {
				fit: "crop",
				crop: { x: 0, y: 0, width: 1, height: 1 },
			}),
		).toThrow(ImageAssetInvalidPresentation);
	});
});
