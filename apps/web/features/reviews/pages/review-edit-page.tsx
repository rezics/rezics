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

import {
	PortableTextEditor,
	spoilerPortableTextEditorCapabilities,
} from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftPortableText,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { PostManagementSectionHeader } from "@/features/posts/components/post-management-section-header";
import { useReviewManagement } from "@/features/posts/components/post-management-workspace";
import { nullablePostLocalizationText } from "@/features/posts/model/post-localization-input";
import { postDetailHref } from "@/features/posts/routing/post-management-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { ReviewScoreAssociationManager } from "../components/review-score-association-manager";
import { invalidateReviews } from "../data/review-cache";

type ReviewLocalizationDraft = { title: string; summary: string; body: PortableTextValue };
const ReviewLocalizationDraftCodec: LocalizedDraftCodec<ReviewLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const body = decodeDraftPortableText(value.body);
		return title === undefined || summary === undefined || !body
			? undefined
			: { title, summary, body };
	},
};

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
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const draft = useLocalizedDraft<ReviewLocalizationDraft>({
		scope: "review-localization",
		baseVersion: review.updatedAt,
		codec: ReviewLocalizationDraftCodec,
		createInitialValue: () => ({
			title: selectedLanguageIsPending ? "" : (review.title ?? ""),
			summary: selectedLanguageIsPending ? "" : (review.summary ?? ""),
			body: readPortableText(selectedLanguageIsPending ? null : review.body),
		}),
	});
	const { value } = draft;
	const [invalid, setInvalid] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!value.body.length) {
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
						value.body,
						selectedLanguageIsPending ? undefined : review.body,
					),
				},
			});
			draft.commit();
			await invalidateReviews(
				queryClient,
				review.id,
				review.targetId,
				review.scores[0]?.realmId,
			);
			await languagesChanged();
			router.push(postDetailHref(review.id));
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
			<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.posts.titleOptional}</FieldLabel>
						<Input
							maxLength={500}
							name="title"
							onChange={(event) => {
								const title = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, title }));
							}}
							value={value.title}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
						<Textarea
							maxLength={2_000}
							name="summary"
							onChange={(event) => {
								const summary = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, summary }));
							}}
							value={value.summary}
						/>
					</Field>
					<PortableTextEditor
						capabilities={spoilerPortableTextEditorCapabilities}
						label={t.ui.body}
						onChange={(body) => draft.setValue((current) => ({ ...current, body }))}
						required
						value={value.body}
					/>
				</FieldGroup>
				{invalid ? (
					<p className="text-sm text-destructive" role="alert">
						{t.errors.invalid}
					</p>
				) : null}
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					isLoading={update.isPending}
					type="submit"
					variant="solid"
				>
					{t.ui.save}
				</Button>
			</form>
		</LocalizedDraftGate>
	);
}
