"use client";

import {
	useDeleteApiPostsByPostIdRepliesByReplyPostId,
	useGetApiPostsByPostIdReplies,
	useGetApiUsersMe,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	usePostApiPostsByPostIdReplies,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

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
import { buildReplyPostTree, findReplyPost, type ReplyPostTreeNode } from "./reply-tree";
import { invalidatePostQueries } from "./query";

export function ReplyPostThread({
	rootPostId,
	parentPostId,
}: {
	rootPostId: string;
	parentPostId?: string;
}) {
	const { t } = useTranslation({ suspense: true });
	const replies = useGetApiPostsByPostIdReplies({
		path: { postId: rootPostId },
		query: { limit: 200 },
	});
	const { data: session } = useHydratedSession();
	const viewer = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const tree = buildReplyPostTree(replies.data?.items ?? []);
	const visibleTree = parentPostId ? (findReplyPost(tree, parentPostId)?.children ?? []) : tree;

	return (
		<section className="flex flex-col gap-4" id="replies">
			<h2 className="font-heading text-2xl font-bold">{t.posts.replies}</h2>
			{session ? (
				<ReplyPostComposer
					rootPostId={rootPostId}
					parentPostId={parentPostId}
					action={t.ui.postReply}
				/>
			) : (
				<SignInButton
					className="w-fit"
					destination={`/posts/${parentPostId ?? rootPostId}`}
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
			) : replies.isError ? (
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
							viewerId={viewer.data?.id}
							canReply={Boolean(session)}
						/>
					))}
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
	viewerId,
	canReply,
}: {
	reply: ReplyPostTreeNode;
	rootPostId: string;
	viewerId?: string;
	canReply: boolean;
}) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const remove = useDeleteApiPostsByPostIdRepliesByReplyPostId();
	const [editing, setEditing] = useState(false);
	const [replying, setReplying] = useState(false);
	const [body, setBody] = useState<PortableTextValue>([]);
	const canEdit =
		viewerId === reply.authorId &&
		reply.status !== "deleted" &&
		Boolean(reply.latestRevisionId);

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
					<Link className="font-medium" href={`/users/${reply.authorId}`}>
						{reply.authorName ?? t.posts.unknownAuthor}
					</Link>
					<Link className="text-muted-foreground text-xs" href={`/posts/${reply.id}`}>
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
						{canReply && (
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
				{replying && (
					<ReplyPostComposer
						rootPostId={rootPostId}
						parentPostId={reply.id}
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
							viewerId={viewerId}
							canReply={canReply}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ReplyPostComposer({
	rootPostId,
	parentPostId,
	action,
	onComplete,
}: {
	rootPostId: string;
	parentPostId?: string;
	action: string;
	onComplete?: () => void;
}) {
	const { t, locale } = useTranslation({ suspense: true });
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
					language: locale.target,
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
