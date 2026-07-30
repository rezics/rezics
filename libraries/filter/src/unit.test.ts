import { describe, expect, it } from "vitest";

import { readSimpleFeedContentKinds } from "./unit";

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
