import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { RealmModerationPage, RealmModerationTarget } from "./realm-moderation-cache";
import { updateRealmModerationPages } from "./realm-moderation-cache";

const page = {
	items: [
		{
			realmId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
			unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
			unitKind: "post",
			language: "zh",
			title: "待處理項目",
			status: "pending",
			postTargetingLocked: false,
			openReportCount: 1,
			allowedCommands: ["approve", "remove", "lock_post_targeting", "note"],
			moderationStatus: "pending",
			createdAt: "2026-07-27T12:00:00.000Z",
			updatedAt: "2026-07-27T12:30:00.000Z",
		},
	],
	nextCursor: null,
} satisfies RealmModerationPage;

const pages: InfiniteData<RealmModerationPage> = {
	pages: [page],
	pageParams: [""],
};

const visibleTarget = {
	status: "visible",
	postTargetingLocked: false,
	openReportCount: 0,
	allowedCommands: ["hide", "remove", "lock_post_targeting", "note"],
	updatedAt: "2026-07-27T12:31:00.000Z",
} satisfies RealmModerationTarget;

describe("Realm moderation queue cache", () => {
	it("updates the server snapshot in an all-status queue", () => {
		const updated = updateRealmModerationPages(
			pages,
			page.items[0]?.unitId ?? "",
			visibleTarget,
			"all",
			"all",
		);
		expect(updated?.pages[0]?.items[0]).toMatchObject(visibleTarget);
	});

	it("removes an item that leaves the active status filter", () => {
		const updated = updateRealmModerationPages(
			pages,
			page.items[0]?.unitId ?? "",
			visibleTarget,
			"pending",
			"all",
		);
		expect(updated?.pages[0]?.items).toEqual([]);
	});

	it("removes an item when its reported-only case is actioned", () => {
		const updated = updateRealmModerationPages(
			pages,
			page.items[0]?.unitId ?? "",
			visibleTarget,
			"all",
			"reported",
		);
		expect(updated?.pages[0]?.items).toEqual([]);
	});
});
