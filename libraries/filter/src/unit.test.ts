import { describe, expect, it } from "vitest";

import {
	assertUnitPredicate,
	createSimpleFeedFilter,
	isSimpleFeedContentKind,
	readSimpleFeedFilter,
	SimpleFeedContentKindValues,
	readSimpleFeedContentKinds,
	readUnitLanguageBoundary,
} from "./unit";

describe("native owner and shape contract", () => {
	it("keeps arbitrary validated native shapes separate from Post subtypes", () => {
		expect(() =>
			assertUnitPredicate({ owner: { in: ["publishing"] }, shape: { in: ["text_version"] } }),
		).not.toThrow();
		expect(() =>
			assertUnitPredicate({ owner: { in: ["post"] }, post: { is: { kind: { in: ["review"] } } } }),
		).not.toThrow();
		for (const invalid of [
			{ kind: { in: ["book"] } },
			{ book: { is: { releaseStatus: { in: ["ongoing"] } } } },
			{ owner: { in: ["book"] } },
			{ shape: { in: ["Invalid Shape"] } },
		])
			expect(() => assertUnitPredicate(invalid)).toThrow();
		expect(isSimpleFeedContentKind("unit:book")).toBe(false);
	});
	it("round-trips every preset with language and scoped constraints inside the execution budget", () => {
		const selection = {
			contentKinds: SimpleFeedContentKindValues,
			languages: ["en" as const],
			realmIds: ["019f9000-0000-7000-8000-000000000001"],
			tagIds: ["019f9000-0000-7000-8000-000000000002"],
		};
		const predicate = createSimpleFeedFilter(selection);
		expect(() => assertUnitPredicate(predicate)).not.toThrow();
		expect(readSimpleFeedFilter(predicate)).toEqual(selection);
	});
});

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
					{ owner: { in: ["publishing"] }, shape: { in: ["text_version"] } },
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
