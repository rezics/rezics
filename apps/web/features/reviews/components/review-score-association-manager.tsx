"use client";

import {
	useGetApiScoresByTargetIdViewer,
	usePutApiPostsByPostIdScores,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldGroup,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useReviewManagement } from "@/features/posts/components/post-management-workspace";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateReviews } from "../data/review-cache";
import { resolveReviewScoreAssociationOptions } from "../model/review-score-association";

export function ReviewScoreAssociationManager() {
	const { item: review } = useReviewManagement();
	const { t } = useTranslation(["engagement", "errors", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const replace = usePutApiPostsByPostIdScores();
	const viewerScores = useGetApiScoresByTargetIdViewer({
		path: { targetId: review.targetId },
		query: { localizationLanguages },
	});
	const [invalid, setInvalid] = useState(false);

	if (viewerScores.isError)
		return (
			<QueryFailure error={viewerScores.error} retry={() => void viewerScores.refetch()} />
		);
	if (!viewerScores.data) return <QueryPending />;

	const options = resolveReviewScoreAssociationOptions(viewerScores.data.items, review.scores);
	const attachedScoreId = review.scores[0]?.scoreId;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const selectedScoreId = String(new FormData(event.currentTarget).get("scoreId") ?? "");
		const selected = selectedScoreId
			? options.find(({ scoreId }) => scoreId === selectedScoreId)
			: undefined;
		if (selectedScoreId && !selected) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			await replace.mutateAsync({
				path: { postId: review.id },
				body: selected ? [{ scoreId: selected.scoreId }] : [],
			});
			await invalidateReviews(queryClient, review.id, review.targetId, selected?.realmId);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.engagement.scoreAssociation}</CardTitle>
				<CardDescription>{t.engagement.scoreAssociationDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field>
							<FieldLabel>{t.engagement.reviewScore}</FieldLabel>
							<NativeSelect
								defaultValue={attachedScoreId ?? ""}
								key={attachedScoreId ?? "no-score"}
								name="scoreId"
							>
								<NativeSelectOption value="">
									{t.engagement.reviewWithoutScore}
								</NativeSelectOption>
								{options.map((option) => (
									<NativeSelectOption key={option.scoreId} value={option.scoreId}>
										{t.engagement.scoreAssociationOption({
											realm: option.realmLabel,
											score: String(option.value),
										})}
									</NativeSelectOption>
								))}
							</NativeSelect>
							{options.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									{t.engagement.noScoredRealms}
								</p>
							) : null}
						</Field>
						{invalid ? (
							<p className="text-sm text-destructive" role="alert">
								{t.errors.invalid}
							</p>
						) : null}
						<RequestFailure error={replace.error} fallback={t.ui.retryLater} />
						<Button
							className="w-fit"
							isLoading={replace.isPending}
							type="submit"
							variant="solid"
						>
							{t.engagement.saveScoreAssociation}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
