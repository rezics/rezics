import { describe, expect, it } from "vitest";
import {
	MusicMediumAttributeInputSchema,
	MusicMediumAttributePolicyInputSchema,
} from "./music-medium-attribute-contracts";

const definitionRevisionId = "01992600-0000-7000-8000-000000000001";
const format = "01992600-0000-7000-8000-000000000002";
const otherFormat = "01992600-0000-7000-8000-000000000003";
const member = "01992600-0000-7000-8000-000000000004";

describe("governed native medium attribute contracts", () => {
	it("keeps enumerated identity and free text distinct", () => {
		expect(
			MusicMediumAttributeInputSchema.parse({
				definitionRevisionId,
				valueMode: "text",
				textValue: "black",
			}),
		).toEqual({ definitionRevisionId, valueMode: "text", textValue: "black" });
		expect(
			MusicMediumAttributeInputSchema.parse({
				definitionRevisionId,
				valueMode: "vocabulary",
				valueRevisionId: member,
			}),
		).toEqual({ definitionRevisionId, valueMode: "vocabulary", valueRevisionId: member });
	});
	it.each([
		{ definitionRevisionId, valueMode: "text", textValue: "", valueRevisionId: member },
		{ definitionRevisionId, valueMode: "text", textValue: "black", valueRevisionId: member },
		{ definitionRevisionId, valueMode: "vocabulary", textValue: "black" },
		{ definitionRevisionId, valueMode: "text", textValue: "a".repeat(4097) },
		{ definitionRevisionId, valueMode: "vocabulary", valueRevisionId: "Black" },
	])("rejects ambiguous or unchecked attribute values", (input) => {
		expect(MusicMediumAttributeInputSchema.safeParse(input).success).toBe(false);
	});
	it("permits value-specific applicability narrower than attribute applicability", () => {
		const policy = {
			definitionRevisionId,
			valueMode: "vocabulary" as const,
			formatRevisionIds: [format, otherFormat],
			valueFormats: [{ valueRevisionId: member, formatRevisionId: format }],
		};
		expect(MusicMediumAttributePolicyInputSchema.parse(policy)).toEqual(policy);
	});
	it.each([
		{ valueMode: "text", formatRevisionIds: [] },
		{ valueMode: "text", formatRevisionIds: [format, format] },
		{
			valueMode: "text",
			formatRevisionIds: [format],
			valueFormats: [{ valueRevisionId: member, formatRevisionId: format }],
		},
		{ valueMode: "vocabulary", formatRevisionIds: [format] },
		{
			valueMode: "vocabulary",
			formatRevisionIds: [format],
			valueFormats: [{ valueRevisionId: member, formatRevisionId: otherFormat }],
		},
		{
			valueMode: "vocabulary",
			formatRevisionIds: [format],
			valueFormats: [
				{ valueRevisionId: member, formatRevisionId: format },
				{ valueRevisionId: member, formatRevisionId: format },
			],
		},
	])("rejects contradictory applicability policy", (input) => {
		expect(
			MusicMediumAttributePolicyInputSchema.safeParse({ definitionRevisionId, ...input }).success,
		).toBe(false);
	});
});
