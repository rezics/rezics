import { describe, expect, it } from "vitest";
import { SoftwareSourceValueSchema } from "./software-source-values";

describe("immutable software mapper values", () => {
	it("keeps source values independent of the native profile that preserves human edits", () => {
		const source = SoftwareSourceValueSchema.parse({
			sourceShape: "content",
			sourceValue: { description: "Source description", originalLanguageTag: "ja" },
		});
		const native = { ...source.sourceValue, description: "Human description" };
		expect(source.sourceValue.description).toBe("Source description");
		expect(native.description).toBe("Human description");
		expect(SoftwareSourceValueSchema.parse(source)).toEqual(source);
	});
	it("uses canonical content and release contracts without accepting arbitrary source fields", () => {
		expect(
			SoftwareSourceValueSchema.safeParse({
				sourceShape: "content",
				sourceValue: { rawSource: "opaque data" },
			}).success,
		).toBe(false);
		expect(
			SoftwareSourceValueSchema.safeParse({
				sourceShape: "release",
				sourceValue: { minimumAge: 256 },
			}).success,
		).toBe(false);
		expect(
			SoftwareSourceValueSchema.safeParse({ sourceShape: "version", sourceValue: {} }).success,
		).toBe(false);
		expect(
			SoftwareSourceValueSchema.safeParse({
				sourceShape: "content",
				sourceValue: { description: "x".repeat(524289) },
			}).success,
		).toBe(false);
	});
});
