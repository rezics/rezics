import { describe, expect, it } from "vitest";
import {
	createDefinitionDraft,
	definitionDraftBody,
	type DefinitionDraft,
} from "./definition-draft";
function draft(): DefinitionDraft {
	return {
		...createDefinitionDraft("en"),
		namespace: "catalog.test",
		key: "length",
		labels: [{ languageTag: "en", label: "Length", description: "" }],
		reason: "Reviewed measurement semantics",
	};
}
describe("governed definition draft boundary", () => {
	it("keeps labels and review reason in the same command", () => {
		expect(definitionDraftBody(draft())).toMatchObject({
			kind: "property",
			valueKind: "string",
			labels: [{ languageTag: "en", label: "Length", description: null }],
			reason: "Reviewed measurement semantics",
		});
	});
	it("rejects duplicate canonical language labels", () => {
		expect(
			definitionDraftBody({
				...draft(),
				labels: [
					{ languageTag: "zh-hant", label: "長度", description: "" },
					{ languageTag: "zh-Hant", label: "長度", description: "" },
				],
			}),
		).toBeUndefined();
	});
	it("uses byte limits for multilingual labels", () => {
		expect(
			definitionDraftBody({
				...draft(),
				labels: [{ languageTag: "zh-Hant", label: "長".repeat(300), description: "" }],
			}),
		).toBeUndefined();
	});
	it("requires a direct review reason", () => {
		expect(definitionDraftBody({ ...draft(), reason: " " })).toBeUndefined();
	});
	it("rejects incomplete role selection before submission", () => {
		expect(
			definitionDraftBody({
				...draft(),
				kind: "predicate",
				constraints: {
					nullable: false,
					integer: false,
					roles: [
						{
							roleRevisionId: "",
							min: 1,
							max: 1,
							targets: [{ owner: "entity", shapes: ["person"] }],
						},
					],
				},
			}),
		).toBeUndefined();
	});
	it("requires structured values to have a matching root rule", () => {
		expect(definitionDraftBody({ ...draft(), valueKind: "array" })).toBeUndefined();
		expect(
			definitionDraftBody({
				...draft(),
				valueKind: "array",
				constraints: {
					nullable: false,
					integer: false,
					rules: [
						{
							position: 0,
							parent: null,
							memberKey: null,
							kind: "array",
							nullable: false,
							integer: false,
						},
						{
							position: 1,
							parent: 0,
							memberKey: null,
							kind: "number",
							nullable: false,
							integer: false,
						},
					],
				},
			}),
		).toBeDefined();
	});
	it("rejects scalar parents in a structural grammar", () => {
		expect(
			definitionDraftBody({
				...draft(),
				valueKind: "object",
				constraints: {
					nullable: false,
					integer: false,
					rules: [
						{
							position: 0,
							parent: null,
							memberKey: null,
							kind: "object",
							nullable: false,
							integer: false,
						},
						{
							position: 1,
							parent: 0,
							memberKey: "text",
							kind: "string",
							nullable: false,
							integer: false,
						},
						{
							position: 2,
							parent: 1,
							memberKey: "bad",
							kind: "number",
							nullable: false,
							integer: false,
						},
					],
				},
			}),
		).toBeUndefined();
	});
});
