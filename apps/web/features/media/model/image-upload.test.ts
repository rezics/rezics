import { describe, expect, it } from "vitest";

import {
	ImageUploadContentTypes,
	MaximumImageUploadBytes,
	validateImageUploadCandidate,
} from "./image-upload";

describe("image upload candidate validation", () => {
	it.each(ImageUploadContentTypes)("accepts a non-empty supported %s file", (type) => {
		expect(validateImageUploadCandidate({ size: 1, type })).toEqual({
			contentType: type,
			ok: true,
		});
	});

	it("rejects zero-byte files before calling the API", () => {
		expect(validateImageUploadCandidate({ size: 0, type: "image/png" })).toEqual({
			ok: false,
			reason: "empty",
		});
	});

	it("rejects oversized and unsupported files", () => {
		expect(
			validateImageUploadCandidate({
				size: MaximumImageUploadBytes + 1,
				type: "image/png",
			}),
		).toEqual({ ok: false, reason: "too-large" });
		expect(validateImageUploadCandidate({ size: 1, type: "image/gif" })).toEqual({
			ok: false,
			reason: "unsupported-type",
		});
	});
});
