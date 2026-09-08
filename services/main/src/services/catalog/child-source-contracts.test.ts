import { describe, it, expect } from "vitest";
import {
	prepareChildSourceProjection,
	validateChildSourceProjection,
	mergeChildSourceProjection,
} from "./child-source-contracts";

describe("pure native child source projections", () => {
	const source = {
		kind: "event" as const,
		publisherCredit: "Publisher A",
		date: { year: 2000, month: null, day: null },
	};
	const observed = ["publisherCredit", "date"];
	it("does not write a human publisher identity into immutable source values", () => {
		const publisherEntityId = crypto.randomUUID();
		const pure = prepareChildSourceProjection(
			"publishing",
			{ ...source, publisherEntityId },
			observed,
		);
		expect(pure.value.fields).toMatchObject({
			publisherEntityId: null,
			publisherCredit: "Publisher A",
		});
		expect(() =>
			validateChildSourceProjection(
				"publishing",
				{ ...pure.value, fields: { ...pure.value.fields, publisherEntityId } },
				observed,
			),
		).toThrow(/not neutral/);
	});
	it("preserves unobserved native fields while source values change", () => {
		const publisherEntityId = crypto.randomUUID();
		const before = prepareChildSourceProjection("publishing", source, observed),
			after = prepareChildSourceProjection(
				"publishing",
				{ ...source, publisherCredit: "Publisher B" },
				observed,
			);
		const value = mergeChildSourceProjection("publishing", before, after, {
			...source,
			publisherEntityId,
		});
		expect(value).toMatchObject({ publisherEntityId, publisherCredit: "Publisher B" });
	});
	it("rejects conflicting changes to the same observed native field", () => {
		const before = prepareChildSourceProjection("publishing", source, observed),
			after = prepareChildSourceProjection(
				"publishing",
				{ ...source, publisherCredit: "Publisher B" },
				observed,
			);
		expect(() =>
			mergeChildSourceProjection("publishing", before, after, {
				...source,
				publisherCredit: "Human correction",
			}),
		).toThrow(/conflicts/);
	});
	it("does not infer missing required coverage fields when creating a native child", () => {
		const targetId = crypto.randomUUID();
		const value = { kind: "publication_work", targetId, position: 0 };
		expect(
			mergeChildSourceProjection(
				"publishing",
				null,
				prepareChildSourceProjection("publishing", value, ["targetId", "position"]),
				null,
			),
		).toMatchObject(value);
		expect(() =>
			mergeChildSourceProjection(
				"publishing",
				null,
				prepareChildSourceProjection("publishing", value, ["position"]),
				null,
			),
		).toThrow();
	});
	it("rejects narrowed observation and cross-owner component reuse", () => {
		const before = prepareChildSourceProjection("publishing", source, observed),
			after = prepareChildSourceProjection("publishing", source, ["publisherCredit"]);
		expect(() => mergeChildSourceProjection("publishing", before, after, source)).toThrow(
			/Narrower/,
		);
		expect(() => prepareChildSourceProjection("program", source, observed)).toThrow(
			/another owner/,
		);
	});
	it("does not resurrect a source child deleted independently", () => {
		const before = prepareChildSourceProjection("publishing", source, observed);
		expect(() => mergeChildSourceProjection("publishing", before, before, null)).toThrow(/removed/);
	});
});
