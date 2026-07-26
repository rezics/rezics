"use client";

import {
	useDeleteApiPostsByPostId,
	useDeleteApiPostsByPostIdRepliesByReplyPostId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidatePostQueries } from "../query";

export function PostDeleteButton({
	postId,
	rootPostId,
}: {
	readonly postId: string;
	readonly rootPostId: string | null;
}) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const removePost = useDeleteApiPostsByPostId();
	const removeReply = useDeleteApiPostsByPostIdRepliesByReplyPostId();
	const pending = removePost.isPending || removeReply.isPending;
	const error = rootPostId ? removeReply.error : removePost.error;
	const onSuccess = async () => {
		await invalidatePostQueries(queryClient, rootPostId ?? postId, postId);
		router.replace(rootPostId ? `/posts/${rootPostId}#replies` : "/posts");
	};
	const remove = () => {
		if (rootPostId) {
			removeReply.mutate(
				{ path: { postId: rootPostId, replyPostId: postId } },
				{ onSuccess },
			);
			return;
		}
		removePost.mutate({ path: { postId } }, { onSuccess });
	};
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">{t.posts.delete}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.posts.deleteTitle}</AlertDialogTitle>
					<AlertDialogDescription>{t.posts.deleteDescription}</AlertDialogDescription>
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
	);
}
