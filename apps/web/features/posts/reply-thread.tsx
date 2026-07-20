"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	getApiPostsByPostIdReplies,
	getApiPostsByPostIdRepliesQueryKey,
	useDeleteApiPostsByPostIdRepliesByReplyPostId,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	usePostApiPostsByPostIdReplies,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	cn,
	FieldGroup,
	PortableTextContent,
	Skeleton,
	Spinner,
} from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { buildReplyPostTree, type ReplyPostTreeNode } from "./reply-tree";
import { invalidatePostQueries } from "./query";
import { PublisherLinks } from "./publisher-list";
import { postHref } from "./url";

export function ReplyPostThread({
	rootPostId,
	parentPostId,
	realmId,
	canReply,
}: {
	rootPostId: string;
	parentPostId?: string;
	realmId?: string;
	canReply: boolean;
}) {
	const { t } = useTranslation(["actions", "posts", "ui"]);
	const baseQuery = {
		limit: 25,
		...(realmId ? { realmId } : {}),
		...(parentPostId ? { parentPostId } : {}),
	};
	const replies = useInfiniteQuery({
		queryKey: [
			...getApiPostsByPostIdRepliesQueryKey({
				path: { postId: rootPostId },
				query: baseQuery,
			}),
			"infinite",
		] as const,
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiPostsByPostIdReplies({
				path: { postId: rootPostId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const { data: session } = useHydratedSession();
	const visibleTree = useMemo(
		() => buildReplyPostTree(replies.data?.pages.flatMap((page) => page.items) ?? []),
		[replies.data?.pages],
	);

	return (
		<section className="flex flex-col gap-4" id="replies">
			<h2 className="font-heading text-2xl font-bold">{t.posts.replies}</h2>
			{!canReply ? (
				<p className="text-muted-foreground text-sm">{t.posts.replyingLocked}</p>
			) : session ? (
				<ReplyPostComposer
					rootPostId={rootPostId}
					parentPostId={parentPostId}
					realmId={realmId}
					action={t.ui.postReply}
				/>
			) : (
				<SignInButton
					className="w-fit"
					destination={postHref(parentPostId ?? rootPostId, realmId)}
					variant="outline"
				>
					{t.posts.signInToReply}
				</SignInButton>
			)}
			{replies.isPending ? (
				<div className="flex flex-col gap-3">
					{Array.from({ length: 3 }, (_, index) => (
						<Skeleton key={index} className="h-32 rounded-xl" />
					))}
				</div>
			) : replies.isError && !replies.data ? (
				<div className="flex flex-col items-start gap-3">
					<RequestFailure error={replies.error} />
					<Button variant="outline" size="sm" onClick={() => void replies.refetch()}>
						{t.actions.retry}
					</Button>
				</div>
			) : visibleTree.length ? (
				<div className="flex flex-col gap-3">
					{visibleTree.map((reply) => (
						<ReplyPostNode
							key={reply.id}
							reply={reply}
							rootPostId={rootPostId}
							realmId={realmId}
							signedIn={Boolean(session)}
						/>
					))}
					{replies.isFetchNextPageError ? (
						<div className="flex flex-col items-center gap-2">
							<RequestFailure error={replies.error} />
							<Button
								onClick={() => void replies.fetchNextPage()}
								size="sm"
								variant="outline"
							>
								{t.actions.retry}
							</Button>
						</div>
					) : replies.hasNextPage ? (
						<Button
							className="self-center"
							disabled={replies.isFetchingNextPage}
							onClick={() => void replies.fetchNextPage()}
							variant="outline"
						>
							{replies.isFetchingNextPage && <Spinner data-icon="inline-start" />}
							{t.actions.loadMore}
						</Button>
					) : null}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.posts.noReplies}</p>
			)}
		</section>
	);
}

function ReplyPostNode({
	reply,
	rootPostId,
	realmId,
	signedIn,
}: {
	reply: ReplyPostTreeNode;
	rootPostId: string;
	realmId?: string;
	signedIn: boolean;
}) {
	const { t } = useTranslation(["actions", "posts", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const remove = useDeleteApiPostsByPostIdRepliesByReplyPostId();
	const [editing, setEditing] = useState(false);
	const [replying, setReplying] = useState(false);
	const [body, setBody] = useState<PortableTextValue>([]);
	const canEdit =
		reply.capabilities.canEdit && reply.status !== "deleted" && Boolean(reply.latestRevisionId);

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!reply.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: reply.id },
				body: {
					body: writePortableText(body, reply.body),
					baseRevisionId: reply.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					await invalidatePostQueries(queryClient, rootPostId, reply.id);
					setEditing(false);
				},
			},
		);
	}

	return (
		<div
			className={cn(reply.parentPostId ? "ms-3 border-s-2 ps-3 sm:ms-5 sm:ps-4" : "border-t")}
		>
			<div className="flex flex-col gap-3 py-4">
				<div className="flex flex-wrap items-center gap-3 text-sm">
					<PublisherLinks
						className="font-medium hover:underline"
						emptyLabel={t.posts.unknownPublisher}
						publishers={reply.publishers}
					/>
					<Link
						className="text-muted-foreground text-xs"
						href={postHref(reply.id, realmId)}
					>
						{new Date(reply.createdAt).toLocaleString()}
					</Link>
				</div>
				{reply.status === "deleted" ? (
					<p className="text-muted-foreground text-sm">{t.posts.deletedReply}</p>
				) : editing ? (
					<form onSubmit={save}>
						<FieldGroup>
							<PortableTextEditor
								label={t.posts.replyBody}
								onChange={setBody}
								value={body}
							/>
							<RequestFailure error={update.error} />
							<div className="flex flex-wrap gap-2">
								<Button
									type="submit"
									size="sm"
									disabled={!body.length || update.isPending}
								>
									{update.isPending && <Spinner data-icon="inline-start" />}
									{t.ui.save}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => setEditing(false)}
								>
									{t.posts.cancel}
								</Button>
							</div>
						</FieldGroup>
					</form>
				) : (
					<div className="prose prose-sm max-w-none">
						<PortableTextContent
							value={readPortableText(reply.body)}
							variant="compact"
						/>
					</div>
				)}
				{reply.status !== "deleted" && (
					<div className="flex flex-wrap gap-1">
						{signedIn && reply.capabilities.canReply && (
							<Button
								type="button"
								size="xs"
								variant="ghost"
								onClick={() => setReplying((value) => !value)}
							>
								{t.posts.reply}
							</Button>
						)}
						{canEdit && (
							<>
								<Button
									type="button"
									size="xs"
									variant="ghost"
									onClick={() => {
										setBody(readPortableText(reply.body));
										setEditing(true);
									}}
								>
									{t.ui.edit}
								</Button>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button type="button" size="xs" variant="ghost">
											{t.posts.delete}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t.posts.deleteReplyTitle}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{t.posts.deleteReplyDescription}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<RequestFailure error={remove.error} />
										<AlertDialogFooter>
											<AlertDialogCancel>{t.posts.cancel}</AlertDialogCancel>
											<Button
												type="button"
												variant="destructive"
												disabled={remove.isPending}
												onClick={() =>
													remove.mutate(
														{
															path: {
																postId: rootPostId,
																replyPostId: reply.id,
															},
														},
														{
															onSuccess: () =>
																invalidatePostQueries(
																	queryClient,
																	rootPostId,
																	reply.id,
																),
														},
													)
												}
											>
												{remove.isPending && (
													<Spinner data-icon="inline-start" />
												)}
												{t.posts.delete}
											</Button>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</>
						)}
					</div>
				)}
				{replying && reply.capabilities.canReply && (
					<ReplyPostComposer
						rootPostId={rootPostId}
						parentPostId={reply.id}
						realmId={realmId}
						action={t.posts.reply}
						onComplete={() => setReplying(false)}
					/>
				)}
			</div>
			{reply.children.length > 0 && (
				<div className="flex flex-col">
					{reply.children.map((child) => (
						<ReplyPostNode
							key={child.id}
							reply={child}
							rootPostId={rootPostId}
							realmId={realmId}
							signedIn={signedIn}
						/>
					))}
				</div>
			)}
			{reply.hasMoreChildren && (
				<Button className="mb-3 ms-3 w-fit sm:ms-5" size="xs" variant="ghost" asChild>
					<Link href={postHref(reply.id, realmId, "replies")}>{t.actions.loadMore}</Link>
				</Button>
			)}
		</div>
	);
}

function ReplyPostComposer({
	rootPostId,
	parentPostId,
	realmId,
	action,
	onComplete,
}: {
	rootPostId: string;
	parentPostId?: string;
	realmId?: string;
	action: string;
	onComplete?: () => void;
}) {
	const { t, locale } = useTranslation(["actions", "posts", "ui"]);
	const queryClient = useQueryClient();
	const create = usePostApiPostsByPostIdReplies();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [editorKey, setEditorKey] = useState(0);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		create.mutate(
			{
				path: { postId: rootPostId },
				body: {
					...(parentPostId ? { parentPostId } : {}),
					...(realmId ? { realmId } : {}),
					language: toContentLanguage(locale.target),
					body: writePortableText(body),
				},
			},
			{
				onSuccess: async () => {
					await invalidatePostQueries(queryClient, rootPostId);
					setBody([]);
					setEditorKey((value) => value + 1);
					onComplete?.();
				},
			},
		);
	}

	return (
		<form onSubmit={submit}>
			<FieldGroup>
				<PortableTextEditor
					key={editorKey}
					label={t.posts.replyBody}
					onChange={setBody}
					value={body}
				/>
				<RequestFailure error={create.error} />
				<Button
					type="submit"
					className="w-fit"
					size="sm"
					disabled={!body.length || create.isPending}
				>
					{create.isPending && <Spinner data-icon="inline-start" />}
					{action}
				</Button>
			</FieldGroup>
		</form>
	);
}
