import { describe, expect, it } from "vitest";
import { SoftwareParticipationContextValuesSchema } from "./software-contexts";
import { VndbVnSchema } from "./vndb";

describe("software participation semantics", () => {
	it("accepts native source-free complete values and normalizes language", () => {
		expect(
			SoftwareParticipationContextValuesSchema.parse({
				label: "Translation team",
				languageTag: "EN-us",
				state: "active",
			}),
		).toEqual({ label: "Translation team", languageTag: "en-US", state: "active" });
	});
	it("rejects provider identity and officialness from native values", () => {
		for (const extra of [
			{ eid: 0 },
			{ sourceNamespace: "vndb" },
			{ official: true },
			{ version: "1.0" },
		])
			expect(() =>
				SoftwareParticipationContextValuesSchema.parse({
					label: null,
					languageTag: null,
					state: "active",
					...extra,
				}),
			).toThrow();
	});
	it("bounds multilingual labels by storage bytes", () => {
		expect(() =>
			SoftwareParticipationContextValuesSchema.parse({
				label: "中".repeat(1366),
				languageTag: null,
				state: "active",
			}),
		).toThrow();
	});
	it("retains null staff context and rejects ambiguous duplicate snapshot local keys", () => {
		const record = {
			id: "v1",
			title: "VN",
			staff: [{ id: "s1", aid: 2, eid: null, role: "director", note: null }],
		};
		expect(VndbVnSchema.parse(record).staff?.[0]?.eid).toBeNull();
		const occurrence = { eid: 0, name: "Translation", lang: "en", official: false };
		expect(() => VndbVnSchema.parse({ ...record, editions: [occurrence, occurrence] })).toThrow();
		expect(VndbVnSchema.parse({ ...record, editions: [occurrence] }).editions).toHaveLength(1);
	});
});
