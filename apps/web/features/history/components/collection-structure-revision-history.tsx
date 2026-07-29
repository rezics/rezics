"use client";

import {
	getApiCollectionsByCollectionIdItemRevisionsQueryKey,
	useGetApiCollectionsByCollectionIdItemRevisions,
	usePostApiCollectionsByCollectionIdItemRevisionsByRevisionIdRestore,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { profileHref } from "@/features/profiles/profile-route";
import { invalidateCollections } from "@/features/collections/data/collection-cache";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function CollectionStructureRevisionHistory({
	collectionId,
	compareHref,
	latestRevisionId,
	canRestore,
}: {
	readonly collectionId: string;
	readonly compareHref: (from: string, to: string) => string;
	readonly latestRevisionId: string;
	readonly canRestore: boolean;
}) {
	const { t, locale } = useTranslation(["history"]);
	const queryClient = useQueryClient();
	const options = { path: { collectionId }, query: { limit: 100 } } as const;
	const query = useGetApiCollectionsByCollectionIdItemRevisions(options);
	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiCollectionsByCollectionIdItemRevisionsQueryKey(options),
			}),
			invalidateCollections(queryClient, collectionId),
		]);
	};
	const restore = usePostApiCollectionsByCollectionIdItemRevisionsByRevisionIdRestore({
		mutation: { onSuccess: refresh },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length)
		return <p className="text-sm text-muted-foreground">{t.history.noRevisions}</p>;
	return (
		<div className="grid gap-3">
			<ol className="grid gap-3">
				{query.data.items.map((revision) => (
					<li key={revision.id}>
						<Card appearance="outlined">
							<CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
								<div className="grid gap-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">
											{t.history.structureKinds[revision.kind]}
										</span>
										{revision.id === latestRevisionId ? (
											<Badge variant="secondary">
												{t.history.currentRevision}
											</Badge>
										) : null}
										{revision.minor ? (
											<Badge variant="outline">{t.history.minorEdit}</Badge>
										) : null}
									</div>
									<p className="text-sm text-muted-foreground">
										{new Intl.DateTimeFormat(locale.current, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(revision.createdAt))}
										{revision.actorProfileId ? (
											<>
												{" · "}
												<Link
													className="hover:underline"
													href={profileHref(revision.actorProfileId)}
												>
													{t.history.revisionBy}
												</Link>
											</>
										) : null}
									</p>
									<p className="text-sm">
										{revision.editSummary ?? t.history.noEditSummary}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									{revision.parentRevisionId ? (
										<Button asChild variant="outline">
											<Link
												href={compareHref(
													revision.parentRevisionId,
													revision.id,
												)}
											>
												{t.history.compareWithParent}
											</Link>
										</Button>
									) : null}
									{canRestore && revision.id !== latestRevisionId ? (
										<Button
											isLoading={restore.isPending}
											onClick={() =>
												restore.mutate({
													path: {
														collectionId,
														revisionId: revision.id,
													},
													body: {
														baseItemsRevisionId: latestRevisionId,
													},
												})
											}
											variant="outline"
										>
											{t.history.restoreRevision}
										</Button>
									) : null}
								</div>
							</CardContent>
						</Card>
					</li>
				))}
			</ol>
			<RequestFailure error={restore.error} />
		</div>
	);
}
