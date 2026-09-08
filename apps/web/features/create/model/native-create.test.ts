import { describe, expect, it } from "vitest";
import {
	buildNativeCreateRequest,
	createNativeCreateDraft,
	NativeCreateKindValues,
	type NativeCreateDraft,
} from "./native-create";
const content = {
	reference: { owner: "software" as const, id: "019fff00-1111-7000-8000-000000000001" },
	shape: "content",
	label: "Software title",
};
function draft(kind: NativeCreateDraft["kind"]): NativeCreateDraft {
	const value = createNativeCreateDraft(kind, "Example");
	return {
		...value,
		fields: { ...value.fields, evidence: "Documented translation differences" },
		references: kind === "software_version" ? { content } : {},
	};
}
describe("native create command boundary", () => {
	it.each(NativeCreateKindValues)("constructs the actual %s command", (kind) => {
		const value = buildNativeCreateRequest(draft(kind));
		expect(value.ok).toBe(true);
		if (value.ok) expect(value.body.kind).toBe(kind);
	});
	it("requires the real software Content parent for a Version", () => {
		const value = draft("software_version");
		expect(buildNativeCreateRequest({ ...value, references: {} })).toEqual({
			ok: false,
			field: "content",
			code: "reference",
		});
		expect(
			buildNativeCreateRequest({
				...value,
				references: { content: { ...content, shape: "release" } },
			}),
		).toEqual({ ok: false, field: "content", code: "reference" });
	});
	it("requires distinguishing evidence instead of inventing a generic variant group", () => {
		const value = draft("software_version");
		expect(
			buildNativeCreateRequest({ ...value, fields: { ...value.fields, evidence: " " } }),
		).toEqual({ ok: false, field: "evidence", code: "required" });
	});
	it("preserves unknown languages and partial calendar precision", () => {
		const value = draft("software_release"),
			result = buildNativeCreateRequest({ ...value, fields: { ...value.fields, year: "2024" } });
		expect(result).toMatchObject({
			ok: true,
			body: {
				name: { languageTag: null },
				details: { date: { year: 2024, month: null, day: null, text: null } },
			},
		});
	});
	it("rejects an impossible calendar day", () => {
		const value = draft("software_release");
		expect(
			buildNativeCreateRequest({
				...value,
				fields: { ...value.fields, year: "2023", month: "2", day: "29" },
			}),
		).toEqual({ ok: false, code: "date", field: "day" });
	});
	it("does not turn a name language into a text language", () => {
		const value = draft("text_version");
		expect(
			buildNativeCreateRequest({ ...value, fields: { ...value.fields, nameLanguage: "zh-hant" } }),
		).toMatchObject({ ok: true, body: { name: { languageTag: "zh-Hant" }, languageTag: null } });
	});
	it("requires a real web address for a web-resource profile", () => {
		const value = { ...draft("reference"), referenceShape: "web_resource" as const };
		expect(buildNativeCreateRequest(value)).toMatchObject({ ok: false, field: "url" });
		expect(
			buildNativeCreateRequest({
				...value,
				fields: { ...value.fields, url: "javascript:alert(1)" },
			}),
		).toEqual({ ok: false, field: "url", code: "url" });
	});
	it("requires coordinates as a pair", () => {
		const value = { ...draft("reference"), referenceShape: "place" as const };
		expect(
			buildNativeCreateRequest({ ...value, fields: { ...value.fields, latitude: "31.2" } }),
		).toEqual({ ok: false, field: "latitude", code: "coordinates" });
	});
	it("requires a program when selecting its season for an episode", () => {
		const value = {
			...draft("program"),
			programShape: "episode" as const,
			references: {
				season: {
					reference: { owner: "program" as const, id: content.reference.id },
					shape: "season",
					label: "Season",
				},
			},
		};
		expect(buildNativeCreateRequest(value)).toEqual({
			ok: false,
			field: "program",
			code: "reference",
		});
	});
	it("does not attach irrelevant parents to a publishing Work", () => {
		const value = draft("publishing_work");
		expect(buildNativeCreateRequest({ ...value, references: { content } })).toEqual({
			ok: true,
			body: { kind: "publishing_work", name: { value: "Example", languageTag: null } },
		});
	});
});
