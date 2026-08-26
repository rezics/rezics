"use client";

import {
	getApiTagPathsByPathIdQueryKey,
	useDeleteApiTagPathsByPathIdVote,
	useGetApiTagPathsByPathId,
	usePutApiTagPathsByPathIdVote,
} from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { TagPathPath } from "../components/tag-path";
import { TagVoteControls } from "../components/tag-vote-controls";

export function TagPathDetailPage({ pathId }: { readonly pathId: string }) {
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const queryInput = {
		path: { pathId },
		query: { localizationLanguages },
	} as const;
	const query = useGetApiTagPathsByPathId(queryInput);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiTagPathsByPathIdQueryKey(queryInput),
		});
	const vote = usePutApiTagPathsByPathIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearVote = useDeleteApiTagPathsByPathIdVote({
		mutation: { onSuccess: invalidate },
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.tags.paths.title} />
			<Card>
				<CardContent className="grid gap-5 p-5 sm:p-6">
					<TagPathPath
						ariaLabel={t.tags.paths.pathLabel}
						fallback={t.tags.paths.memberFallback}
						members={query.data.members}
					/>
					<p className="text-sm text-muted-foreground">{t.tags.createPath.description}</p>
					<TagVoteControls
						canVote={Boolean(session)}
						isPending={vote.isPending || clearVote.isPending}
						onClear={() => clearVote.mutate({ path: { pathId } })}
						onVote={(value) =>
							vote.mutate({
								path: { pathId },
								body: { value },
							})
						}
						score={toFiniteApiNumber(query.data.score) ?? 0}
						viewerVote={query.data.viewerVote}
						voteCount={toNonNegativeApiInteger(query.data.voteCount)}
					/>
					<RequestFailure error={vote.error ?? clearVote.error} fallback={t.ui.retryLater} />
				</CardContent>
			</Card>
		</main>
	);
}
