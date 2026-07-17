"use client";

import {
	getApiHistoryUnitsByUnitIdRevisionsQueryKey,
	useGetApiHistoryUnitsByUnitIdCompare,
	useGetApiHistoryUnitsByUnitIdRevisions,
	useGetApiPostsByPostId,
	usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdRestore,
	usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdUndo,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	PageHeading,
	QueryFailure,
	QueryPending,
	Spinner,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidatePostQueries } from "./query";

export function PostHistoryPage({ postId }: { postId: string }) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const post = useGetApiPostsByPostId({ path: { postId } });
	const history = useGetApiHistoryUnitsByUnitIdRevisions({
		path: { unitId: postId },
		query: { limit: 100 },
	});
	const restore = usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdRestore();
	const undo = usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdUndo();
	if (post.isError) return <QueryFailure error={post.error} retry={() => void post.refetch()} />;
	if (history.isError)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;
	if (!post.data || !history.data) return <QueryPending />;

	const currentRevision = history.data.items.find((revision) => revision.isCurrent);
	const pending = restore.isPending || undo.isPending;
	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiHistoryUnitsByUnitIdRevisionsQueryKey({
					path: { unitId: postId },
				}),
			}),
			invalidatePostQueries(queryClient, post.data.rootPostId ?? postId, postId),
		]);
	};

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.posts.historyTitle}
				description={
					post.data.postKind === "reply"
						? t.posts.replyPost
						: (post.data.title ?? t.posts.untitled)
				}
				action={
					<Button variant="outline" asChild>
						<Link href={`/posts/${postId}`}>{t.actions.view}</Link>
					</Button>
				}
			/>
			<RequestFailure error={restore.error ?? undo.error} />
			{history.data.items.length ? (
				<div className="flex flex-col gap-3">
					{history.data.items.map((revision) => {
						const hidden = Object.values(revision.visibility).some(Boolean);
						return (
							<Card key={revision.id}>
								<CardHeader>
									<CardTitle className="flex flex-wrap items-center gap-2 text-base">
										<time dateTime={revision.createdAt}>
											{new Date(revision.createdAt).toLocaleString()}
										</time>
										{revision.isCurrent && (
											<Badge>{t.posts.currentRevision}</Badge>
										)}
										{revision.minor && (
											<Badge variant="secondary">{t.posts.minorEdit}</Badge>
										)}
										{hidden && (
											<Badge variant="destructive">
												{t.posts.hiddenRevision}
											</Badge>
										)}
										{revision.tags.map((tag) => (
											<Badge key={tag} variant="outline">
												{tag}
											</Badge>
										))}
									</CardTitle>
									<CardDescription>
										{revision.editSummary ?? t.posts.noEditSummary} ·{" "}
										{formatDelta(revision.sizeDelta)}
										{revision.actorProfileId && (
											<>
												{" · "}
												{t.posts.revisionBy}{" "}
												<Link
													className="text-primary"
													href={`/users/${revision.actorProfileId}`}
												>
													{revision.actorName ??
														revision.actorProfileId.slice(0, 8)}
												</Link>
											</>
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									{revision.parentRevisionId && (
										<Button size="sm" variant="outline" asChild>
											<Link
												href={`/posts/${postId}/history/compare?from=${revision.parentRevisionId}&to=${revision.id}`}
											>
												{t.posts.compareWithParent}
											</Link>
										</Button>
									)}
									{post.data.capabilities.canEdit &&
										revision.parentRevisionId &&
										currentRevision && (
											<Button
												size="sm"
												variant="secondary"
												disabled={pending}
												onClick={() =>
													undo.mutate(
														{
															path: {
																unitId: postId,
																revisionId: revision.id,
															},
															body: {
																baseRevisionId: currentRevision.id,
															},
														},
														{ onSuccess: refresh },
													)
												}
											>
												{undo.isPending && (
													<Spinner data-icon="inline-start" />
												)}
												{t.posts.undoRevision}
											</Button>
										)}
									{post.data.capabilities.canEdit &&
										!revision.isCurrent &&
										currentRevision && (
											<Button
												size="sm"
												disabled={pending}
												onClick={() =>
													restore.mutate(
														{
															path: {
																unitId: postId,
																revisionId: revision.id,
															},
															body: {
																baseRevisionId: currentRevision.id,
															},
														},
														{ onSuccess: refresh },
													)
												}
											>
												{restore.isPending && (
													<Spinner data-icon="inline-start" />
												)}
												{t.posts.restoreRevision}
											</Button>
										)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.posts.noRevisions}</p>
			)}
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
	const { t } = useTranslation({ suspense: true });
	if (!from || !to)
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.posts.compareTitle} />
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			</main>
		);
	return <PostRevisionCompareResult postId={postId} from={from} to={to} />;
}

function PostRevisionCompareResult({
	postId,
	from,
	to,
}: {
	postId: string;
	from: string;
	to: string;
}) {
	const { t } = useTranslation({ suspense: true });
	const compare = useGetApiHistoryUnitsByUnitIdCompare({
		path: { unitId: postId },
		query: { from, to },
	});
	if (compare.isError)
		return <QueryFailure error={compare.error} retry={() => void compare.refetch()} />;
	if (!compare.data) return <QueryPending />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.posts.compareTitle}
				action={
					<Button variant="outline" asChild>
						<Link href={`/posts/${postId}/history`}>{t.posts.history}</Link>
					</Button>
				}
			/>
			<div className="flex flex-col gap-3">
				{compare.data.changes.map((change) => (
					<Card key={change.path}>
						<CardHeader>
							<CardTitle className="font-mono text-sm">{change.path}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<RevisionValue label={t.posts.before} value={change.before} />
							<RevisionValue label={t.posts.after} value={change.after} />
						</CardContent>
					</Card>
				))}
			</div>
		</main>
	);
}

function RevisionValue({ label, value }: { label: string; value: unknown }) {
	return (
		<section className="min-w-0">
			<h2 className="mb-2 text-sm font-semibold">{label}</h2>
			<pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		</section>
	);
}

function formatDelta(value: string | number) {
	const delta = Number(value);
	return `${delta > 0 ? "+" : ""}${delta} B`;
}
