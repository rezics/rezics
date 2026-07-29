"use client";

import {
	type GetApiPostsByPostIdStatus200,
	usePatchApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { Button, Field, FieldGroup, FieldLabel, Input, Textarea } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState, type FormEvent } from "react";

import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { PostManagementSectionHeader } from "@/features/posts/components/post-management-section-header";
import { useReviewManagement } from "@/features/posts/components/post-management-workspace";
import { nullablePostLocalizationText } from "@/features/posts/model/post-localization-input";
import { postDetailHref } from "@/features/posts/routing/post-management-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { ReviewScoreAssociationManager } from "../components/review-score-association-manager";
import { invalidateReviews } from "../data/review-cache";

export function ReviewEditPage() {
	const { t } = useTranslation(["engagement", "errors", "posts"]);
	const { item: review } = useReviewManagement();
	const { selectedLanguage } = useContentLanguageEditor();
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
				{capabilities.canEdit ? (
					<>
						<ContentLanguageControl />
						<ReviewEditForm key={`${review.id}:${selectedLanguage}`} review={review} />
					</>
				) : null}
				{capabilities.canManageScores ? <ReviewScoreAssociationManager /> : null}
			</div>
		</section>
	);
}

function ReviewEditForm({
	review,
}: {
	review: Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;
}) {
	const update = usePatchApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useApplicationRouter();
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
	const [body, setBody] = useState<PortableTextValue>(() =>
		readPortableText(selectedLanguageIsPending ? null : review.body),
	);
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
					language: selectedLanguage,
					title: nullablePostLocalizationText(form, "title"),
					summary: nullablePostLocalizationText(form, "summary"),
					body: writePortableText(
						body,
						selectedLanguageIsPending ? undefined : review.body,
					),
				},
			});
			await invalidateReviews(
				queryClient,
				review.id,
				review.targetId,
				review.scores[0]?.contextUnitId,
			);
			setDirty(false);
			await languagesChanged();
			router.push(postDetailHref(review.id));
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form
			className="flex flex-col gap-6"
			onChange={() => setDirty(true)}
			onSubmit={(event) => void submit(event)}
		>
			<FieldGroup>
				<Field>
					<FieldLabel>{t.posts.titleOptional}</FieldLabel>
					<Input
						defaultValue={selectedLanguageIsPending ? "" : (review.title ?? "")}
						maxLength={500}
						name="title"
					/>
				</Field>
				<Field>
					<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
					<Textarea
						defaultValue={selectedLanguageIsPending ? "" : (review.summary ?? "")}
						maxLength={2_000}
						name="summary"
					/>
				</Field>
				<PortableTextEditor
					label={t.ui.body}
					onChange={(value) => {
						setBody(value);
						setDirty(true);
					}}
					required
					value={body}
				/>
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
