"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { type GetApiReviewsStatus200, useGetApiReviews } from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import Link from "next/link";

import { AttributionLinks } from "@/features/posts/attribution-list";
import { useTranslation } from "@/i18n/client";
import type { UnitScore } from "../model/score-value";

export interface UnitReviewListProps {
	readonly languages?: readonly ContentLanguage[];
	readonly limit?: number;
	readonly realmId?: string;
	readonly scores?: readonly UnitScore[];
	readonly scoreRealmId?: string;
	readonly search?: string;
	readonly targetId: string;
}

export function UnitReviewList({
	languages,
	limit = 50,
	realmId,
	scores,
	scoreRealmId,
	search,
	targetId,
}: UnitReviewListProps) {
	const query = useGetApiReviews({
		query: {
			targetId,
			...(realmId ? { realmId } : {}),
			...(languages?.length ? { languages: [...languages] } : {}),
			...(search ? { search } : {}),
			...(scores?.length ? { scores: [...scores] } : {}),
			...(scores?.length && scoreRealmId ? { scoreRealmId } : {}),
			limit,
		},
	});
	const { t } = useTranslation(["engagement", "posts", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data?.items.length)
		return <p className="text-sm text-muted-foreground">{t.engagement.emptyReviews}</p>;
	return <ReviewCards items={query.data.items} />;
}

type ReviewListItem = GetApiReviewsStatus200["items"][number];

export function ReviewCards({ items }: { readonly items: readonly ReviewListItem[] }) {
	const { t } = useTranslation(["engagement", "posts", "search", "ui"]);
	return (
		<div className="grid gap-4">
			{items.map((review) => (
				<Card className="transition-colors hover:bg-surface-hover" key={review.id}>
					<CardHeader
						description={review.summary ?? undefined}
						title={review.title ?? t.ui.unnamed}
					>
						<CardAction>
							<Button asChild size="sm" variant="outline">
								<Link href={`/reviews/${review.id}`}>{t.engagement.select}</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<AttributionLinks
								attributions={review.attributions}
								emptyLabel={t.posts.unknownAttribution}
							/>
							{review.language ? (
								<Badge variant="secondary">
									{t.search.languageOptions[review.language]}
								</Badge>
							) : null}
						</div>
						{review.scores.length ? (
							<span className="font-medium text-foreground">
								{review.scores
									.map(({ value }) =>
										t.engagement.scoreOutOfTen({
											score: String(value),
										}),
									)
									.join(" · ")}
							</span>
						) : null}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
