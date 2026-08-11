"use client";

import {
	getApiMessagesConversationsByConversationIdMessages,
	getApiMessagesConversationsByConversationIdMessagesQueryKey,
	getApiMessagesConversationsByConversationIdQueryKey,
	getApiMessagesConversationsQueryKey,
	type GetApiMessagesConversationsByConversationIdMessagesQuery,
	useGetApiMessagesConversationsByConversationId,
	usePostApiMessagesConversationsByConversationIdMessages,
	usePutApiMessagesConversationsByConversationIdRead,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Field,
	FieldLabel,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { RequireSession } from "@/features/auth/require-session";
import { NotificationsHref } from "@/features/notifications/routing/notification-routes";
import { normalizeUnreadCount } from "@/features/notifications/model/unread-count";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { messageAnchorId } from "../routing/message-routes";

const MessagePageQuery = {
	limit: 30,
} satisfies GetApiMessagesConversationsByConversationIdMessagesQuery;

function formatMessageDate(value: string, locale: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
}

export function ConversationPage({ conversationId }: { conversationId: string }) {
	return (
		<RequireSession>
			<ConversationContent conversationId={conversationId} />
		</RequireSession>
	);
}

function ConversationContent({ conversationId }: { conversationId: string }) {
	const { t, locale } = useTranslation(["messages"]);
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState("");
	const path = useMemo(() => ({ conversationId }), [conversationId]);
	const conversation = useGetApiMessagesConversationsByConversationId({ path });
	const messages = useInfiniteQuery({
		queryKey: getApiMessagesConversationsByConversationIdMessagesQueryKey({
			path,
			query: MessagePageQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiMessagesConversationsByConversationIdMessages({
				path,
				query: {
					...MessagePageQuery,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const refreshConversation = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiMessagesConversationsByConversationIdQueryKey({ path }),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiMessagesConversationsQueryKey(),
			}),
		]);
	const readConversation = usePutApiMessagesConversationsByConversationIdRead({
		mutation: { onSuccess: refreshConversation },
	});
	const sendMessage = usePostApiMessagesConversationsByConversationIdMessages({
		mutation: {
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({
						queryKey: getApiMessagesConversationsByConversationIdMessagesQueryKey({
							path,
						}),
					}),
					refreshConversation(),
				]),
		},
	});
	const newestMessage = messages.data?.pages[0]?.items[0];
	const loadedPageCount = messages.data?.pages.length ?? 0;
	const unreadCount = normalizeUnreadCount(conversation.data?.unreadCount);
	useEffect(() => {
		if (
			!newestMessage ||
			unreadCount === 0 ||
			readConversation.isPending ||
			readConversation.variables?.body.lastReadMessageId === newestMessage.id
		)
			return;
		readConversation.mutate({
			path,
			body: { lastReadMessageId: newestMessage.id },
		});
	}, [
		newestMessage,
		path,
		readConversation.isPending,
		readConversation.mutate,
		readConversation.variables,
		unreadCount,
	]);
	useEffect(() => {
		if (loadedPageCount === 0) return;
		const anchor = window.location.hash.slice(1);
		if (!anchor) return;
		document.getElementById(anchor)?.scrollIntoView({ block: "center" });
	}, [loadedPageCount]);

	if (conversation.isPending || messages.isPending) return <QueryPending />;
	if (conversation.isError)
		return <QueryFailure error={conversation.error} retry={() => void conversation.refetch()} />;
	if (messages.isError)
		return <QueryFailure error={messages.error} retry={() => void messages.refetch()} />;

	const participantName = conversation.data.otherUserName ?? t.messages.unknownParticipant;
	const orderedMessages = messages.data.pages
		.flatMap((page) => page.items)
		.slice()
		.reverse();
	async function submitMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const content = draft.trim();
		if (!content || sendMessage.isPending) return;
		await sendMessage.mutateAsync({ path, body: { content } });
		setDraft("");
	}

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="quiet">
				<Link href={NotificationsHref}>
					<ArrowLeft aria-hidden className="rtl:rotate-180" />
					{t.messages.backToNotifications}
				</Link>
			</Button>
			<PageHeading
				description={t.messages.description}
				title={t.messages.conversationWith({ name: participantName })}
			/>

			{messages.hasNextPage ? (
				<Button
					className="self-center"
					disabled={messages.isFetchingNextPage}
					onClick={() => void messages.fetchNextPage()}
					variant="outline"
				>
					{t.messages.loadOlder}
				</Button>
			) : null}

			{orderedMessages.length ? (
				<ol className="flex flex-col gap-3">
					{orderedMessages.map((message) => {
						const fromParticipant = message.senderProfileId === conversation.data.otherProfileId;
						return (
							<li
								className="scroll-mt-24 rounded-xl border border-border-weak px-4 py-3 target:ring-2 target:ring-primary/40"
								id={messageAnchorId(message.id)}
								key={message.id}
							>
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
									<strong className="font-medium">
										{fromParticipant ? participantName : t.messages.you}
									</strong>
									<time dateTime={message.createdAt}>
										{formatMessageDate(message.createdAt, locale.current)}
									</time>
								</div>
								<p className="mt-2 whitespace-pre-wrap text-sm leading-6">
									{message.content ?? t.messages.deletedMessage}
								</p>
							</li>
						);
					})}
				</ol>
			) : (
				<div className="rounded-xl border border-border-weak px-6 py-10 text-center">
					<h2 className="font-medium">{t.messages.emptyTitle}</h2>
					<p className="mt-2 text-muted-foreground text-sm">{t.messages.emptyDescription}</p>
				</div>
			)}

			<form className="grid gap-3" onSubmit={(event) => void submitMessage(event)}>
				<Field>
					<FieldLabel>{t.messages.composeLabel}</FieldLabel>
					<Textarea
						maxLength={20_000}
						onChange={(event) => setDraft(event.currentTarget.value)}
						placeholder={t.messages.placeholder}
						required
						value={draft}
					/>
				</Field>
				<Button
					className="justify-self-end"
					disabled={!draft.trim() || sendMessage.isPending}
					type="submit"
					variant="solid"
				>
					<Send aria-hidden />
					{t.messages.send}
				</Button>
			</form>
			<RequestFailure error={sendMessage.error ?? readConversation.error} />
		</main>
	);
}
