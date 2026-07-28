"use client";

import {
	useDeleteApiPostsByPostId,
	useDeleteApiPostsByPostIdRepliesByReplyPostId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	MenuItem,
} from "@rezics/ui";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidatePostQueries } from "../query";

/** Describes the only two safe edit transitions exposed by the shared menu. */
export type PostOverflowEditAction =
	Readonly<{ kind: "link"; href: string }> | Readonly<{ kind: "command"; onSelect: () => void }>;

/**
 * Extends the shared feed overflow menu with management actions for a Post.
 *
 * @alpha
 */
export function PostOverflowMenu({
	canDelete,
	editAction,
	postId,
	realmId,
	rootPostId,
}: {
	readonly canDelete: boolean;
	readonly editAction?: PostOverflowEditAction;
	readonly postId: string;
	readonly realmId?: string;
	readonly rootPostId: string | null;
}) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const removePost = useDeleteApiPostsByPostId();
	const removeReply = useDeleteApiPostsByPostIdRepliesByReplyPostId();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const isReply = rootPostId !== null;
	const pending = removePost.isPending || removeReply.isPending;
	const error = isReply ? removeReply.error : removePost.error;

	const onDeleteSuccess = async () => {
		await invalidatePostQueries(queryClient, rootPostId ?? postId, postId);
		setDeleteOpen(false);
		router.replace(rootPostId ? `/posts/${rootPostId}#replies` : "/posts");
	};
	const remove = () => {
		if (rootPostId) {
			removeReply.mutate(
				{ path: { postId: rootPostId, replyPostId: postId } },
				{ onSuccess: onDeleteSuccess },
			);
			return;
		}
		removePost.mutate({ path: { postId } }, { onSuccess: onDeleteSuccess });
	};

	return (
		<>
			<FeedOverflowMenu
				canExclude={false}
				itemId={postId}
				reportTarget={{ unitId: postId, realmId }}
			>
				{editAction?.kind === "link" ? (
					<MenuItem asChild value="edit-post">
						<Link href={editAction.href}>
							<PencilIcon aria-hidden />
							{t.ui.edit}
						</Link>
					</MenuItem>
				) : editAction?.kind === "command" ? (
					<MenuItem onSelect={editAction.onSelect} value="edit-post">
						<PencilIcon aria-hidden />
						{t.ui.edit}
					</MenuItem>
				) : null}
				{canDelete ? (
					<MenuItem
						onSelect={() => setDeleteOpen(true)}
						value="delete-post"
						variant="destructive"
					>
						<Trash2Icon aria-hidden />
						{t.posts.delete}
					</MenuItem>
				) : null}
			</FeedOverflowMenu>
			<AlertDialog onOpenChange={({ open }) => setDeleteOpen(open)} open={deleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{isReply ? t.posts.deleteReplyTitle : t.posts.deleteTitle}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{isReply ? t.posts.deleteReplyDescription : t.posts.deleteDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<RequestFailure error={error} />
					<AlertDialogFooter>
						<AlertDialogCancel>{t.posts.cancel}</AlertDialogCancel>
						<Button
							isLoading={pending}
							onClick={remove}
							type="button"
							variant="destructive"
						>
							{t.posts.delete}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
