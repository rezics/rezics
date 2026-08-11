"use client";

import {
	getApiNotifications,
	getApiNotificationsQueryKey,
	getApiNotificationsUnreadCountQueryKey,
	type GetApiNotificationsQuery,
	usePutApiNotificationsByNotificationIdRead,
	usePutApiNotificationsReadAll,
} from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Mail } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { normalizeUnreadCount } from "../model/unread-count";
import {
	optimisticallyMarkAllNotificationsRead,
	optimisticallyMarkNotificationRead,
	restoreNotificationCache,
	type NotificationCacheSnapshot,
} from "../model/notification-read-cache";
import { AccessInvitationsHref, notificationHref } from "../routing/notification-routes";

const NotificationReadMutationScope = { id: "notification-read" } as const;

function formatNotificationDate(value: string, locale: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
}

export function NotificationsPage() {
	return (
		<RequireSession>
			<NotificationsContent />
		</RequireSession>
	);
}

function NotificationsContent() {
	const { t, locale } = useTranslation(["notifications"]);
	const queryClient = useQueryClient();
	const [pendingNotificationIds, setPendingNotificationIds] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const baseQuery = { limit: 30 } satisfies GetApiNotificationsQuery;
	const notifications = useInfiniteQuery({
		queryKey: getApiNotificationsQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiNotifications({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: getApiNotificationsQueryKey() }),
			queryClient.invalidateQueries({
				queryKey: getApiNotificationsUnreadCountQueryKey(),
			}),
		]);
	const markAllRead = usePutApiNotificationsReadAll<NotificationCacheSnapshot>({
		mutation: {
			scope: NotificationReadMutationScope,
			onMutate: () =>
				optimisticallyMarkAllNotificationsRead(queryClient, new Date().toISOString()),
			onError: (_error, _variables, snapshot) =>
				restoreNotificationCache(queryClient, snapshot),
			onSettled: refresh,
		},
	});
	const markRead = usePutApiNotificationsByNotificationIdRead<NotificationCacheSnapshot>({
		mutation: {
			scope: NotificationReadMutationScope,
			onMutate: (variables) => {
				const notificationId = variables.path.notificationId;
				setPendingNotificationIds((current) => new Set(current).add(notificationId));
				return optimisticallyMarkNotificationRead(
					queryClient,
					notificationId,
					new Date().toISOString(),
				);
			},
			onError: (_error, _variables, snapshot) =>
				restoreNotificationCache(queryClient, snapshot),
			onSettled: (_data, _error, variables) => {
				const notificationId = variables.path.notificationId;
				setPendingNotificationIds((current) => {
					const next = new Set(current);
					next.delete(notificationId);
					return next;
				});
				return refresh();
			},
		},
	});

	if (notifications.isPending) return <QueryPending />;
	if (notifications.isError)
		return (
			<QueryFailure error={notifications.error} retry={() => void notifications.refetch()} />
		);

	const items = notifications.data.pages.flatMap((page) => page.items);
	const hasUnread = normalizeUnreadCount(notifications.data.pages[0]?.unreadCount) > 0;
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading
				action={
					<>
						<Button asChild variant="outline">
							<Link href={AccessInvitationsHref}>
								<Mail aria-hidden />
								{t.notifications.center.receivedInvitations}
							</Link>
						</Button>
						{hasUnread ? (
							<Button
								disabled={markAllRead.isPending}
								onClick={() => markAllRead.mutate({ body: {} })}
								variant="solid"
							>
								<Check aria-hidden />
								{t.notifications.center.markAllRead}
							</Button>
						) : null}
					</>
				}
				description={t.notifications.center.description}
				title={t.notifications.center.title}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						const href = notificationHref(item);
						const content = (
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									{item.readAt === null ? (
										<>
											<span className="sr-only">
												{t.notifications.center.unread}
											</span>
											<span
												aria-hidden
												className="size-2 shrink-0 rounded-full bg-primary"
											/>
										</>
									) : null}
									<strong className="font-medium text-sm">{item.title}</strong>
								</div>
								<p className="mt-1 text-muted-foreground text-sm leading-6">
									{item.body}
								</p>
								<time
									className="mt-1 block text-muted-foreground text-xs"
									dateTime={item.createdAt}
								>
									{formatNotificationDate(item.createdAt, locale.current)}
								</time>
							</div>
						);
						return (
							<article className="flex items-start gap-3 py-4" key={item.id}>
								<Link
									className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									href={href}
									onClick={() => {
										if (
											item.readAt === null &&
											!pendingNotificationIds.has(item.id)
										)
											markRead.mutate({
												path: { notificationId: item.id },
											});
									}}
								>
									{content}
								</Link>
								{item.readAt === null ? (
									<Button
										aria-label={t.notifications.center.markRead}
										className="shrink-0"
										disabled={pendingNotificationIds.has(item.id)}
										onClick={() =>
											markRead.mutate({ path: { notificationId: item.id } })
										}
										size="icon-md"
										title={t.notifications.center.markRead}
										variant="quiet"
									>
										<Check aria-hidden />
									</Button>
								) : null}
							</article>
						);
					})}
				</div>
			) : (
				<div className="rounded-xl border border-border-weak px-6 py-10 text-center">
					<h2 className="font-medium">{t.notifications.center.emptyTitle}</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						{t.notifications.center.emptyDescription}
					</p>
				</div>
			)}

			{notifications.hasNextPage ? (
				<Button
					className="self-center"
					disabled={notifications.isFetchingNextPage}
					onClick={() => void notifications.fetchNextPage()}
					variant="outline"
				>
					{t.notifications.center.loadMore}
				</Button>
			) : null}
			<RequestFailure error={markAllRead.error ?? markRead.error} />
		</main>
	);
}
