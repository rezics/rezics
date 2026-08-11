import { describe, expect, it } from "vitest";

import { readSimpleFeedContentKinds, readUnitLanguageBoundary } from "./unit";

describe("Feed content-kind execution hint", () => {
	it("finds a standard content clause without discarding stricter predicates", () => {
		expect(
			readSimpleFeedContentKinds({
				all: [
					{
						all: [
							{ post: { is: { kind: { in: ["review"] } } } },
							{
								localizations: {
									some: { language: { in: ["zh", "en"] } },
								},
							},
						],
					},
					{
						post: {
							is: {
								subject: {
									is: {
										id: {
											in: ["019f9000-0000-7000-8000-000000000001"],
										},
									},
								},
							},
						},
					},
				],
			}),
		).toEqual(["post:review"]);
	});

	it("does not infer a content hint through disjunction or competing clauses", () => {
		expect(
			readSimpleFeedContentKinds({
				any: [
					{ post: { is: { kind: { in: ["review"] } } } },
					{ post: { is: { kind: { in: ["excerpt"] } } } },
				],
			}),
		).toBeUndefined();
		expect(
			readSimpleFeedContentKinds({
				all: [
					{ post: { is: { kind: { in: ["review"] } } } },
					{ post: { is: { kind: { in: ["excerpt"] } } } },
				],
			}),
		).toBeUndefined();
	});
});

describe("Feed language presentation boundary", () => {
	it("finds a language clause nested with stricter product predicates", () => {
		expect(
			readUnitLanguageBoundary({
				all: [
					{ localizations: { some: { language: { in: ["ja", "ko"] } } } },
					{ post: { is: { kind: { in: ["review"] } } } },
				],
			}),
		).toEqual(["ja", "ko"]);
	});

	it("unions only disjunctions whose every branch has a language boundary", () => {
		expect(
			readUnitLanguageBoundary({
				any: [
					{ localizations: { some: { language: { in: ["ja"] } } } },
					{ localizations: { some: { language: { in: ["ko"] } } } },
				],
			}),
		).toEqual(["ja", "ko"]);
		expect(
			readUnitLanguageBoundary({
				any: [
					{ localizations: { some: { language: { in: ["ja"] } } } },
					{ kind: { in: ["book"] } },
				],
			}),
		).toBeUndefined();
	});

	it("unions independent localization existence requirements and ignores negative ones", () => {
		expect(
			readUnitLanguageBoundary({
				all: [
					{ localizations: { some: { language: { in: ["ja", "ko"] } } } },
					{ localizations: { some: { language: { in: ["ko", "en"] } } } },
				],
			}),
		).toEqual(["ja", "ko", "en"]);
		expect(
			readUnitLanguageBoundary({
				not: { localizations: { some: { language: { in: ["zh"] } } } },
			}),
		).toBeUndefined();
	});

	it("derives a boundary through nested localization logic on the same row", () => {
		expect(
			readUnitLanguageBoundary({
				localizations: {
					some: {
						any: [{ language: { in: ["ja"] } }, { language: { in: ["ko"] } }],
					},
				},
			}),
		).toEqual(["ja", "ko"]);
		expect(
			readUnitLanguageBoundary({
				localizations: {
					some: {
						all: [{ language: { in: ["ja", "ko"] } }, { language: { in: ["ko", "en"] } }],
					},
				},
			}),
		).toEqual(["ko"]);
	});
});
