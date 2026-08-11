import {
	getApiNotificationsQueryKey,
	getApiNotificationsUnreadCountQueryKey,
	type GetApiNotificationsStatus200,
	type GetApiNotificationsUnreadCountStatus200,
} from "@rezics/openapi-tanstack-query";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

type NotificationPages = InfiniteData<GetApiNotificationsStatus200, unknown>;
type UnreadCountResponse = GetApiNotificationsUnreadCountStatus200;

export interface NotificationCacheSnapshot {
	readonly notificationQueries: readonly (readonly [QueryKey, NotificationPages | undefined])[];
	readonly unreadCountQueries: readonly (readonly [QueryKey, UnreadCountResponse | undefined])[];
}

function withCountValue<
	Count extends GetApiNotificationsStatus200["unreadCount"] | UnreadCountResponse["count"],
>(count: Count, value: number): Count {
	switch (count.kind) {
		case "exact":
		case "lower-bound":
			return { ...count, value };
		case "estimate":
			return { ...count, value };
	}
}

function updateNotificationPages(
	data: NotificationPages | undefined,
	notificationId: string | undefined,
	readAt: string,
	decrementCount: boolean,
): NotificationPages | undefined {
	if (!data) return data;
	const markAll = notificationId === undefined;
	return {
		...data,
		pages: data.pages.map((page) => ({
			...page,
			items: page.items.map((item) =>
				item.readAt === null && (markAll || item.id === notificationId)
					? { ...item, readAt }
					: item,
			),
			unreadCount: withCountValue(
				page.unreadCount,
				markAll
					? 0
					: decrementCount
						? Math.max(0, page.unreadCount.value - 1)
						: page.unreadCount.value,
			),
		})),
	};
}

async function optimisticallyMarkRead(
	queryClient: QueryClient,
	notificationId: string | undefined,
	readAt: string,
): Promise<NotificationCacheSnapshot> {
	const notificationQueryKey = getApiNotificationsQueryKey();
	const unreadCountQueryKey = getApiNotificationsUnreadCountQueryKey();
	await Promise.all([
		queryClient.cancelQueries({ queryKey: notificationQueryKey }),
		queryClient.cancelQueries({ queryKey: unreadCountQueryKey }),
	]);
	const notificationQueries = queryClient.getQueriesData<NotificationPages>({
		queryKey: notificationQueryKey,
	});
	const unreadCountQueries = queryClient.getQueriesData<UnreadCountResponse>({
		queryKey: unreadCountQueryKey,
	});
	const decrementCount =
		notificationId !== undefined &&
		notificationQueries.some(([, data]) =>
			data?.pages.some((page) =>
				page.items.some((item) => item.id === notificationId && item.readAt === null),
			),
		);
	queryClient.setQueriesData<NotificationPages>({ queryKey: notificationQueryKey }, (data) =>
		updateNotificationPages(data, notificationId, readAt, decrementCount),
	);
	queryClient.setQueriesData<UnreadCountResponse>({ queryKey: unreadCountQueryKey }, (data) =>
		data
			? {
					...data,
					count: withCountValue(
						data.count,
						notificationId === undefined
							? 0
							: decrementCount
								? Math.max(0, data.count.value - 1)
								: data.count.value,
					),
				}
			: data,
	);
	return { notificationQueries, unreadCountQueries };
}

export function optimisticallyMarkNotificationRead(
	queryClient: QueryClient,
	notificationId: string,
	readAt: string,
): Promise<NotificationCacheSnapshot> {
	return optimisticallyMarkRead(queryClient, notificationId, readAt);
}

export function optimisticallyMarkAllNotificationsRead(
	queryClient: QueryClient,
	readAt: string,
): Promise<NotificationCacheSnapshot> {
	return optimisticallyMarkRead(queryClient, undefined, readAt);
}

export function restoreNotificationCache(
	queryClient: QueryClient,
	snapshot: NotificationCacheSnapshot | undefined,
): void {
	if (!snapshot) return;
	for (const [queryKey, data] of snapshot.notificationQueries)
		queryClient.setQueryData(queryKey, data);
	for (const [queryKey, data] of snapshot.unreadCountQueries)
		queryClient.setQueryData(queryKey, data);
}
