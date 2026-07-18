import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
	invalidateBookContentStructure,
	invalidateChapterContent,
	invalidateUnitDetail,
} from "./unit-cache";

function createQueryClient() {
	const queryClient = new QueryClient();
	const invalidateQueries = vi
		.spyOn(queryClient, "invalidateQueries")
		.mockResolvedValue(undefined);
	return { queryClient, invalidateQueries };
}

describe("unit cache invalidation", () => {
	it("invalidates a detail query without invalidating its list by default", async () => {
		const { queryClient, invalidateQueries } = createQueryClient();

		await invalidateUnitDetail(queryClient, "book", "unit-1");

		expect(invalidateQueries).toHaveBeenCalledTimes(1);
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: [
				{ url: "/api/units/:type/:unitId", params: { type: "book", unitId: "unit-1" } },
			],
		});
	});

	it("includes the list when a unit mutation changes list-visible data", async () => {
		const { queryClient, invalidateQueries } = createQueryClient();

		await invalidateUnitDetail(queryClient, "book", "unit-1", true);

		expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: [
				{ url: "/api/units/:type/:unitId", params: { type: "book", unitId: "unit-1" } },
			],
		});
		expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: [{ url: "/api/units/:type", params: { type: "book" } }],
		});
	});

	it("targets Content Structure and chapter content changed by edits", async () => {
		const { queryClient, invalidateQueries } = createQueryClient();

		await invalidateBookContentStructure(queryClient, "book-1");
		await invalidateChapterContent(queryClient, "chapter-1", "zh-CN");

		expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: [
				{
					url: "/api/units/book/:unitId/content-structure/nodes",
					params: { unitId: "book-1" },
				},
			],
		});
		expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: [
				{ url: "/api/chapters/:chapterId", params: { chapterId: "chapter-1" } },
				{ language: "zh-CN" },
			],
		});
	});
});
