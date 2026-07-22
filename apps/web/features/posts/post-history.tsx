"use client";

import { useGetApiPostsByPostId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { useTranslation } from "@/i18n/client";
import { invalidatePostQueries } from "./query";

export function PostHistoryPage({ postId }: { postId: string }) {
	const { t } = useTranslation(["actions", "history", "posts"]);
	const queryClient = useQueryClient();
	const post = useGetApiPostsByPostId({ path: { postId } });
	if (post.isError) return <QueryFailure error={post.error} retry={() => void post.refetch()} />;
	if (!post.data) return <QueryPending />;
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="outline">
						<Link href={`/posts/${postId}`}>{t.actions.view}</Link>
					</Button>
				}
				description={
					post.data.postKind === "reply"
						? t.posts.replyPost
						: (post.data.title ?? t.posts.untitled)
				}
				title={t.history.title}
			/>
			<UnitRevisionHistory
				compareHref={(from, to) =>
					`/posts/${postId}/history/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
				}
				onChanged={() =>
					invalidatePostQueries(queryClient, post.data.rootPostId ?? postId, postId)
				}
				unitId={postId}
			/>
		</main>
	);
}

export function PostRevisionComparePage({
	postId,
	from,
	to,
}: {
	postId: string;
	from: string | null;
	to: string | null;
}) {
	const { t } = useTranslation(["errors", "history"]);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="outline">
						<Link href={`/posts/${postId}/history`}>{t.history.backToHistory}</Link>
					</Button>
				}
				title={t.history.compareTitle}
			/>
			{from && to ? (
				<UnitRevisionCompare from={from} to={to} unitId={postId} />
			) : (
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			)}
		</main>
	);
}
