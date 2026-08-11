import {
	getApiNotificationsQueryKey,
	getApiNotificationsUnreadCountQueryKey,
	type GetApiNotificationsStatus200,
	type GetApiNotificationsUnreadCountStatus200,
} from "@rezics/openapi-tanstack-query";
import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
	optimisticallyMarkAllNotificationsRead,
	optimisticallyMarkNotificationRead,
	restoreNotificationCache,
} from "./notification-read-cache";

const FirstNotificationId = "019b76da-a800-7300-8000-000000000001";
const SecondNotificationId = "019b76da-a800-7300-8000-000000000002";
const ReadAt = "2026-08-11T08:00:00.000Z";

function notificationItem(id: string): GetApiNotificationsStatus200["items"][number] {
	return {
		id,
		title: "title",
		body: "body",
		actor: null,
		subject: null,
		readAt: null,
		createdAt: "2026-08-11T07:00:00.000Z",
		kind: "reply",
		context: { type: "reply" },
		destination: { kind: "post", postId: SecondNotificationId },
	};
}

function notificationData(): InfiniteData<GetApiNotificationsStatus200, unknown> {
	return {
		pageParams: [undefined],
		pages: [
			{
				items: [
					notificationItem(FirstNotificationId),
					notificationItem(SecondNotificationId),
				],
				nextCursor: null,
				pollCursor: null,
				unreadCount: {
					kind: "estimate",
					value: 2,
					asOf: "2026-08-11T07:30:00.000Z",
				},
			},
		],
	};
}

function unreadCountData(): GetApiNotificationsUnreadCountStatus200 {
	return {
		count: {
			kind: "estimate",
			value: 2,
			asOf: "2026-08-11T07:30:00.000Z",
		},
	};
}

function createCache() {
	const queryClient = new QueryClient();
	const notificationsKey = getApiNotificationsQueryKey({ query: { limit: 30 } });
	const unreadCountKey = getApiNotificationsUnreadCountQueryKey();
	queryClient.setQueryData(notificationsKey, notificationData());
	queryClient.setQueryData(unreadCountKey, unreadCountData());
	return { queryClient, notificationsKey, unreadCountKey };
}

describe("notification optimistic read cache", () => {
	it("marks one row read and decrements every cached count without changing its kind", async () => {
		const { queryClient, notificationsKey, unreadCountKey } = createCache();

		await optimisticallyMarkNotificationRead(queryClient, FirstNotificationId, ReadAt);

		const notifications =
			queryClient.getQueryData<InfiniteData<GetApiNotificationsStatus200, unknown>>(
				notificationsKey,
			);
		expect(notifications?.pages[0]?.items.map((item) => item.readAt)).toEqual([ReadAt, null]);
		expect(notifications?.pages[0]?.unreadCount).toMatchObject({
			kind: "estimate",
			value: 1,
		});
		expect(
			queryClient.getQueryData<GetApiNotificationsUnreadCountStatus200>(unreadCountKey)
				?.count,
		).toMatchObject({ kind: "estimate", value: 1 });

		await optimisticallyMarkNotificationRead(queryClient, FirstNotificationId, ReadAt);
		expect(
			queryClient.getQueryData<GetApiNotificationsUnreadCountStatus200>(unreadCountKey)?.count
				.value,
		).toBe(1);
	});

	it("marks all cached rows read and can restore the exact snapshot after a failure", async () => {
		const { queryClient, notificationsKey, unreadCountKey } = createCache();
		const snapshot = await optimisticallyMarkAllNotificationsRead(queryClient, ReadAt);

		expect(
			queryClient
				.getQueryData<InfiniteData<GetApiNotificationsStatus200, unknown>>(notificationsKey)
				?.pages[0]?.items.every((item) => item.readAt === ReadAt),
		).toBe(true);
		expect(
			queryClient.getQueryData<GetApiNotificationsUnreadCountStatus200>(unreadCountKey)?.count
				.value,
		).toBe(0);

		restoreNotificationCache(queryClient, snapshot);

		expect(
			queryClient
				.getQueryData<InfiniteData<GetApiNotificationsStatus200, unknown>>(notificationsKey)
				?.pages[0]?.items.map((item) => item.readAt),
		).toEqual([null, null]);
		expect(
			queryClient.getQueryData<GetApiNotificationsUnreadCountStatus200>(unreadCountKey)?.count
				.value,
		).toBe(2);
	});
});
