import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { SearchFeedQueryKey } from "@/features/content-feed/data/search-feed-query-key";
import { invalidatePostQueries } from "./query";

describe("Post query invalidation", () => {
	it("invalidates Search-backed discussion lists after publishing", async () => {
		const queryClient = new QueryClient();
		const discussionKey = [
			...SearchFeedQueryKey,
			"feed",
			{ kind: "template", template: "global" },
			{ subjectId: "book-1" },
		] as const;
		queryClient.setQueryData(discussionKey, { pages: [] });

		await invalidatePostQueries(queryClient, "post-1");

		expect(queryClient.getQueryState(discussionKey)?.isInvalidated).toBe(true);
	});
});
