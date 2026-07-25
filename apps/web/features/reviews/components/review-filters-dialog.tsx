"use client";

import { ContentLanguageValues } from "@rezics/i18n";
import {
	Button,
	ChoiceSelect,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldLabel,
} from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import {
	EmptyReviewFilters,
	hasReviewFilters,
	parseReviewScoreFilters,
	type ReviewFilterModel,
} from "../model/review-filter-model";
import { UnitScoreValues } from "../model/score-value";

export function ReviewFiltersDialog({
	initialFilters,
	onApply,
	onClose,
}: {
	readonly initialFilters: ReviewFilterModel;
	readonly onApply: (filters: ReviewFilterModel) => void;
	readonly onClose: () => void;
}) {
	const { t } = useTranslation(["engagement", "search"]);
	const [draft, setDraft] = useState(initialFilters);

	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.engagement.reviewFiltersDescription}
					title={t.engagement.reviewFilters}
				/>
				<DialogBody className="grid gap-5">
					<Button
						className="w-full justify-start"
						disabled={!hasReviewFilters(draft)}
						onClick={() => setDraft(EmptyReviewFilters)}
						type="button"
						variant="quiet"
					>
						{t.engagement.clearReviewFilters}
					</Button>

					<Field>
						<FieldLabel>{t.engagement.reviewLanguage}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.engagement.reviewLanguage}
							multiple
							onValueChange={(languages) =>
								setDraft((current) => ({ ...current, languages }))
							}
							options={ContentLanguageValues.map((value) => ({
								label: t.search.languageOptions[value],
								value,
							}))}
							placeholder={t.engagement.allReviewLanguages}
							value={draft.languages}
						/>
					</Field>

					<Field>
						<FieldLabel>{t.engagement.reviewScoreFilter}</FieldLabel>
						<ChoiceSelect
							appearance="field"
							ariaLabel={t.engagement.reviewScoreFilter}
							multiple
							onValueChange={(values) =>
								setDraft((current) => ({
									...current,
									scores: parseReviewScoreFilters(values),
								}))
							}
							options={UnitScoreValues.map((score) => ({
								label: t.engagement.reviewScoreOption({ score }),
								value: String(score),
							}))}
							placeholder={t.engagement.allReviewScores}
							value={draft.scores.map(String)}
						/>
					</Field>

					<Field>
						<FieldLabel>{t.engagement.filterReviewRealm}</FieldLabel>
						<EntityPicker
							index="realms"
							onChange={(realm) => setDraft((current) => ({ ...current, realm }))}
							value={draft.realm}
						/>
						{draft.realm ? (
							<Button
								className="w-fit"
								onClick={() => setDraft(({ realm: _realm, ...current }) => current)}
								size="sm"
								type="button"
								variant="quiet"
							>
								{t.engagement.allReviewRealms}
							</Button>
						) : (
							<p className="text-sm text-muted-foreground">
								{t.engagement.allReviewRealms}
							</p>
						)}
					</Field>
				</DialogBody>
				<DialogFooter>
					<Button onClick={onClose} type="button" variant="outline">
						{t.engagement.cancel}
					</Button>
					<Button onClick={() => onApply(draft)} type="button" variant="solid">
						{t.engagement.applyReviewFilters}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
