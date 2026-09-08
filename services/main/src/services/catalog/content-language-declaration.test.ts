import { z } from "zod";
import { describe, expect, it } from "vitest";
import { catalogValueNodes } from "./value-nodes";
import {
	contentLanguageDeclarationSemanticId,
	declarationFromValueNodes,
	ConsumptionLanguagesSchema,
	MaximumLanguageDeclarationNodes,
	ContentLanguageDeclarationPutSchema,
	ContentLanguageDeclarationSchema,
	ContentLanguageDeclarationMutationSchema,
	ContentLanguageDeclarationHistorySchema,
	ContentLanguageDeclarationHistoryValueSchema,
	ContentLanguageDeclarationRestoreSchema,
} from "./content-language-declaration";
const id = "019b0000-0000-7000-8000-000000000001";
describe("native consumption language declarations", () => {
	it("exports every public declaration contract as JSON Schema", () => {
		for (const schema of [
			ContentLanguageDeclarationPutSchema,
			ContentLanguageDeclarationSchema,
			ContentLanguageDeclarationMutationSchema,
			ContentLanguageDeclarationHistorySchema,
			ContentLanguageDeclarationHistoryValueSchema,
			ContentLanguageDeclarationRestoreSchema,
		])
			expect(() => z.toJSONSchema(schema)).not.toThrow();
	});
	it("has a stable owner-separated internal semantic identity", () => {
		const ref = { owner: "publishing" as const, id };
		expect(contentLanguageDeclarationSemanticId(ref)).toBe(
			contentLanguageDeclarationSemanticId(ref),
		);
		expect(contentLanguageDeclarationSemanticId(ref)).not.toBe(
			contentLanguageDeclarationSemanticId({ owner: "program", id }),
		);
	});
	it("does not accept a caller-chosen semantic identity", () => {
		expect(
			ContentLanguageDeclarationPutSchema.safeParse({
				expectedRevision: 1,
				expectedHeadVersion: 0,
				value: [],
				semanticId: id,
			}).success,
		).toBe(false);
	});
	it("round trips exact canonical language-channel pairs and empty declarations", () => {
		for (const input of [
			[],
			[{ languageTag: "en" }],
			[{ languageTag: "ja", channels: ["audio", "subtitle"] }],
		]) {
			const canonical = ConsumptionLanguagesSchema.parse(input);
			expect(declarationFromValueNodes([...catalogValueNodes(canonical)])).toEqual(canonical);
		}
	});
	it("rejects an unregistered tag or undeclared channel", () => {
		expect(() => ConsumptionLanguagesSchema.parse([{ languageTag: "not-a-language" }])).toThrow();
		expect(() =>
			ConsumptionLanguagesSchema.parse([{ languageTag: "en", channels: ["dub"] }]),
		).toThrow();
	});
	it("does not turn source-like fields into consumption declarations", () => {
		expect(() =>
			declarationFromValueNodes([
				...catalogValueNodes([{ languageTag: "en", originalLanguage: true }]),
			]),
		).toThrow();
	});
	it("rejects incomplete or misplaced persisted nodes", () => {
		const values = [...catalogValueNodes([{ languageTag: "en" }])];
		expect(() => declarationFromValueNodes(values.slice(0, 2))).toThrow();
		expect(() =>
			declarationFromValueNodes(
				values.map((node, index) =>
					index === 2 ? { ...node, parentPosition: 0, parentKind: "array", memberKey: null } : node,
				),
			),
		).toThrow();
	});
	it("bounds 64 declarations including all four channels to 449 nodes", () => {
		const raw = Array.from({ length: 64 }, (_, index) => ({
			languageTag: `en-${String(index).padStart(3, "0")}`,
			channels: ["text", "audio", "subtitle", "interface"],
		}));
		expect([...catalogValueNodes(raw)]).toHaveLength(MaximumLanguageDeclarationNodes);
		expect(() =>
			ConsumptionLanguagesSchema.parse(Array.from({ length: 65 }, () => ({ languageTag: "en" }))),
		).toThrow();
	});
});
