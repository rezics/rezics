"use client";

import {
	type GetApiReviewsByReviewIdStatus200,
	usePatchApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { toContentLanguage } from "@rezics/i18n";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { PostManagementSectionHeader } from "@/features/posts/components/post-management-section-header";
import { useReviewManagement } from "@/features/posts/components/post-management-workspace";
import { postDetailHref } from "@/features/posts/routing/post-management-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { ReviewScoreAssociationManager } from "../components/review-score-association-manager";
import { invalidateReviews } from "../data/review-cache";

export function ReviewEditPage() {
	const { t } = useTranslation(["engagement", "errors", "posts"]);
	const { item: review } = useReviewManagement();
	const { capabilities } = review;
	if (!capabilities.canEdit && !capabilities.canManageScores)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<PostManagementSectionHeader
				description={t.posts.workspace.sections.main.reviewDescription}
				title={t.engagement.editReview}
			/>
			<div className="grid gap-8">
				{capabilities.canEdit ? <ReviewEditForm key={review.id} review={review} /> : null}
				{capabilities.canManageScores ? <ReviewScoreAssociationManager /> : null}
			</div>
		</section>
	);
}

function ReviewEditForm({ review }: { review: GetApiReviewsByReviewIdStatus200 }) {
	const update = usePatchApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["errors", "ui"]);
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
				path: { reviewId: review.id },
				body: {
					language: toContentLanguage(locale.target),
					title: String(form.get("title") ?? "").trim(),
					...(String(form.get("summary") ?? "").trim()
						? { summary: String(form.get("summary") ?? "").trim() }
						: {}),
					body: writePortableText(body, review.body),
				},
			});
			await invalidateReviews(
				queryClient,
				review.id,
				review.targetId,
				review.scores[0]?.contextUnitId,
			);
			router.push(postDetailHref("review", review.id));
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
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
					<Input defaultValue={review.summary ?? ""} maxLength={2000} name="summary" />
				</Field>
				<PortableTextEditor label={t.ui.body} onChange={setBody} required value={body} />
			</FieldGroup>
			{invalid ? (
				<p className="text-sm text-destructive" role="alert">
					{t.errors.invalid}
				</p>
			) : null}
			<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			<Button className="w-fit" isLoading={update.isPending} type="submit" variant="solid">
				{t.ui.save}
			</Button>
		</form>
	);
}
