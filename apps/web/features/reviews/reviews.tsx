"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	type GetApiReviewsByReviewIdStatus200,
	getApiReviewsByReviewIdQueryKey,
	getApiReviewsQueryKey,
	useGetApiReviews,
	useGetApiReviewsByReviewId,
	usePatchApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { UnitAttributionProposalManager } from "@/features/governance/unit-workflows";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { ReviewComposer } from "./components/review-composer";
import { ReviewCards } from "./components/unit-review-list";

async function invalidateReviews(
	queryClient: ReturnType<typeof useQueryClient>,
	reviewId?: string,
) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
		...(reviewId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiReviewsByReviewIdQueryKey({ path: { reviewId } }),
					}),
				]
			: []),
	]);
}

export function ReviewsPage() {
	const query = useGetApiReviews({ query: { limit: 50, sort: "best" } });
	const { t } = useTranslation(["actions", "engagement", "errors", "posts", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.engagement.reviews}
				action={
					<Button variant="solid" asChild>
						<Link href="/reviews/new">{t.engagement.newReview}</Link>
					</Button>
				}
			/>
			{query.data?.items.length ? (
				<ReviewCards items={query.data.items} />
			) : (
				<p className="text-muted-foreground text-sm">{t.engagement.emptyReviews}</p>
			)}
		</main>
	);
}

export function ReviewCreate() {
	const router = useRouter();
	const { t } = useTranslation(["engagement"]);
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.newReview} />
				<ReviewComposer onCreated={(reviewId) => router.push(`/reviews/${reviewId}`)} />
			</main>
		</RequireSession>
	);
}

export function ReviewEdit({ id }: { id: string }) {
	const query = useGetApiReviewsByReviewId({ path: { reviewId: id } });
	const { t } = useTranslation(["actions", "engagement", "errors", "posts", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return <ReviewEditForm review={query.data} reviewId={id} />;
}

function ReviewEditForm({
	review,
	reviewId,
}: {
	review: GetApiReviewsByReviewIdStatus200;
	reviewId: string;
}) {
	const update = usePatchApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["actions", "engagement", "errors", "posts", "ui"]);
	const [body, setBody] = useState<PortableTextValue>(() => readPortableText(review.body));
	const [invalid, setInvalid] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!body.length) {
			setInvalid(true);
			return;
		}
		const form = new FormData(event.currentTarget);
		setInvalid(false);
		try {
			await update.mutateAsync({
				path: { reviewId },
				body: {
					language: toContentLanguage(locale.target),
					title: String(form.get("title") ?? "").trim(),
					...(String(form.get("summary") ?? "").trim()
						? { summary: String(form.get("summary") ?? "").trim() }
						: {}),
					body: writePortableText(body, review.body),
				},
			});
			await invalidateReviews(queryClient, reviewId);
			router.push(`/reviews/${reviewId}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.editReview} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input
								defaultValue={review.title ?? ""}
								maxLength={500}
								name="title"
								required
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Input
								defaultValue={review.summary ?? ""}
								maxLength={2000}
								name="summary"
							/>
						</Field>
						<PortableTextEditor
							label={t.ui.body}
							onChange={setBody}
							required
							value={body}
						/>
					</FieldGroup>
					{invalid && <p className="text-destructive text-sm">{t.errors.invalid}</p>}
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button variant="solid" isLoading={update.isPending} type="submit">
						{t.ui.save}
					</Button>
				</form>
				<UnitAttributionProposalManager unitId={reviewId} />
			</main>
		</RequireSession>
	);
}
