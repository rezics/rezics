"use client";

import { useGetApiReviews } from "@rezics/openapi-tanstack-query";
import {
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

export function UnitReviewList({ realmId, targetId }: { realmId?: string; targetId: string }) {
	const query = useGetApiReviews({
		query: { targetId, ...(realmId ? { realmId } : {}), limit: 50 },
	});
	const { t } = useTranslation(["engagement", "posts", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data?.items.length)
		return <p className="text-sm text-muted-foreground">{t.engagement.emptyReviews}</p>;
	return (
		<div className="grid gap-3">
			{query.data.items.map((review) => (
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
						<AttributionLinks
							attributions={review.attributions}
							emptyLabel={t.posts.unknownAttribution}
						/>
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
