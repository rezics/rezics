"use client";

import { useGetApiReviews } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { ReviewCards } from "../components/unit-review-list";

export function ReviewsPage() {
	const query = useGetApiReviews({ query: { limit: 50, sort: "best" } });
	const { t } = useTranslation(["engagement"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="solid">
						<Link href="/reviews/new">{t.engagement.newReview}</Link>
					</Button>
				}
				title={t.engagement.reviews}
			/>
			{query.data?.items.length ? (
				<ReviewCards items={query.data.items} />
			) : (
				<p className="text-sm text-muted-foreground">{t.engagement.emptyReviews}</p>
			)}
		</main>
	);
}
