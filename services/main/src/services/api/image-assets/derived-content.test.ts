import { describe, expect, it } from "vitest";

import { negotiateImageAssetFormat } from "./derived-content";

describe("derived ImageAsset format negotiation", () => {
	it("prefers AVIF, then WebP, when the client accepts modern formats", () => {
		expect(negotiateImageAssetFormat("image/avif,image/webp,image/*", "image/jpeg")).toBe(
			"avif",
		);
		expect(negotiateImageAssetFormat("image/webp,image/*", "image/jpeg")).toBe("webp");
	});

	it("preserves alpha-capable fallback for PNG and otherwise emits JPEG", () => {
		expect(negotiateImageAssetFormat("image/png", "image/png")).toBe("png");
		expect(negotiateImageAssetFormat("image/png", "image/webp")).toBe("png");
		expect(negotiateImageAssetFormat("image/jpeg", "image/gif")).toBe("jpeg");
	});

	it("honors quality and explicit exclusions", () => {
		expect(
			negotiateImageAssetFormat(
				"image/avif;q=0.4,image/webp;q=0.8,image/*;q=0.2",
				"image/jpeg",
			),
		).toBe("webp");
		expect(
			negotiateImageAssetFormat("image/avif;q=0,image/webp;q=1,image/*;q=1", "image/png"),
		).toBe("webp");
	});
});
