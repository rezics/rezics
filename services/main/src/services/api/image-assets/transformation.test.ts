import { describe, expect, it } from "vitest";

import { cropRectToPixelTrim, pixelTrimToExtract } from "./transformation";

describe("image asset crop transformation", () => {
	it("converts normalized crop coordinates to edge trim before resize", () => {
		const trim = cropRectToPixelTrim({ x: 0.125, y: 0.25, width: 0.5, height: 0.5 }, 1600, 900);
		expect(trim).toEqual({ top: 225, right: 600, bottom: 225, left: 200 });
		expect(pixelTrimToExtract(trim, 1600, 900)).toEqual({
			left: 200,
			top: 225,
			width: 800,
			height: 450,
		});
	});

	it("rounds the selected bounds outwards", () => {
		expect(
			cropRectToPixelTrim({ x: 0.333, y: 0.111, width: 0.333, height: 0.555 }, 101, 99),
		).toEqual({ top: 10, right: 33, bottom: 33, left: 33 });
	});
});
