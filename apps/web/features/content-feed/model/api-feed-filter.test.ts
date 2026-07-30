import { describe, expect, it } from "vitest";

import { createApiFeedFilter } from "./api-feed-filter";

describe("API Feed Filter", () => {
	it("keeps full text as UnitFilter.search beside the domain predicate", () => {
		expect(
			createApiFeedFilter({
				additionalFilter: {
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
				contentKinds: ["post:review"],
				languages: ["zh"],
				query: "memory",
				realmIds: [],
				tagIds: [],
			}),
		).toEqual({
			search: { query: "memory" },
			where: {
				all: [
					{
						all: [
							{ post: { is: { kind: { in: ["review"] } } } },
							{
								localizations: {
									some: { language: { in: ["zh"] } },
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
			},
		});
	});
});
