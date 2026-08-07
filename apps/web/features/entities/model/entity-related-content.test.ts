import { describe, expect, it } from "vitest";

import { createEntityRelatedContentRequest } from "./entity-related-content";

const EntityId = "00000000-0000-4000-8000-000000000001";

describe("Entity related content", () => {
	it("selects the union of credited and subject-associated Units", () => {
		expect(createEntityRelatedContentRequest(EntityId)).toEqual({
			contexts: [],
			injections: [],
			state: {
				filter: {
					where: {
						any: [
							{ creditAttributions: { some: { id: { in: [EntityId] } } } },
							{ subjectAssociations: { some: { id: { in: [EntityId] } } } },
						],
					},
				},
				pageSize: 20,
				sort: "updatedAt:desc",
			},
		});
	});
});
