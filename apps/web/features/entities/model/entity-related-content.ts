import type { SearchFeedRequest } from "@/features/content-feed/data/search-feed-list";

export function createEntityRelatedContentRequest(entityId: string): SearchFeedRequest {
	return {
		contexts: [],
		injections: [],
		state: {
			filter: {
				where: {
					any: [
						{ creditAttributions: { some: { id: { in: [entityId] } } } },
						{ subjectAssociations: { some: { id: { in: [entityId] } } } },
					],
				},
			},
			pageSize: 20,
			sort: "updatedAt:desc",
		},
	};
}
