"use client";

import { usePostApiReviews } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
	Button,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	Textarea,
	UnitMultiPicker,
} from "@rezics/ui";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import {
	PortableTextEditor,
	spoilerPortableTextEditorCapabilities,
} from "@/features/editor/portable-text-editor";
import { optionalPostLocalizationText } from "@/features/posts/model/post-localization-input";
import { MaximumPostPublishRealmCount } from "@/features/posts/model/post-publication";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { invalidateReviews } from "../data/review-cache";
import { useDefaultScoreRealm } from "../data/default-score-realm";
import { ScoreInput } from "./score-input";
import { ScoreRealmPicker } from "./score-realm-picker";

export interface ReviewComposerTarget {
	readonly id: string;
	readonly label: string;
}

export function ReviewComposer({
	onCreated,
	progressEntryId,
	target: fixedTarget,
}: {
	onCreated: (reviewId: string) => void | Promise<void>;
	progressEntryId?: string;
	target?: ReviewComposerTarget;
}) {
	const create = usePostApiReviews();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["engagement", "errors", "posts", "ui"]);
	const [target, setTarget] = useState<ReviewComposerTarget>();
	const [publishRealmIds, setPublishRealmIds] = useState<readonly string[]>([]);
	const [selectedScoreRealm, setSelectedScoreRealm] = useState<ReviewComposerTarget>();
	const [score, setScore] = useState<number>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);
	const defaultScoreRealm = useDefaultScoreRealm();
	const selectedTarget = fixedTarget ?? target;
	const scoreRealm = selectedScoreRealm ?? defaultScoreRealm.realm;
	const scoreRealmOptions = [
		...new Map(
			[defaultScoreRealm.realm, selectedScoreRealm]
				.filter((realm) => realm !== undefined)
				.map((realm) => [realm.id, realm]),
		).values(),
	];
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement(publishRealmIds);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		if (!selectedTarget || !body.length || (score !== undefined && !scoreRealm)) {
			setInvalid(true);
			return;
		}
		const form = new FormData(formElement);
		const title = optionalPostLocalizationText(form, "title");
		const summary = optionalPostLocalizationText(form, "summary");
		setInvalid(false);
		const contentLanguage = await language.resolveLanguage(formElement);
		const selectedPublishRealmIds = [...publishRealmIds];
		try {
			await rulesAcknowledgement.run(async () => {
				const result = await create.mutateAsync({
					body: {
						targetId: selectedTarget.id,
						...(progressEntryId ? { progressEntryId } : {}),
						publishRealmIds: selectedPublishRealmIds,
						...(score !== undefined && scoreRealm
							? { score: { realmId: scoreRealm.id, value: score } }
							: {}),
						language: contentLanguage,
						...(title ? { title } : {}),
						...(summary ? { summary } : {}),
						body: writePortableText(body),
					},
				});
				await invalidateReviews(
					queryClient,
					result.id,
					selectedTarget.id,
					score !== undefined ? scoreRealm?.id : undefined,
				);
				await onCreated(result.id);
				formElement.reset();
				setBody([]);
				setScore(undefined);
				setPublishRealmIds([]);
				setSelectedScoreRealm(undefined);
				language.reset();
				if (!fixedTarget) setTarget(undefined);
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			<form
				className="grid gap-6"
				onInput={language.onInput}
				onSubmit={(event) => void submit(event)}
			>
				<FieldGroup>
					{progressEntryId ? (
						<p className="rounded-lg bg-primary/8 px-4 py-3 text-sm">
							{t.engagement.progressJournal.reviewBindingNotice}
						</p>
					) : null}
					{fixedTarget ? null : (
						<Field required>
							<FieldLabel>{t.engagement.reviewTarget}</FieldLabel>
							<EntityPicker
								ariaLabel={t.engagement.reviewTarget}
								index="units"
								onChange={setTarget}
								placeholder={t.ui.pickerPlaceholders.unit}
								value={target}
							/>
						</Field>
					)}
					<Field>
						<FieldLabel>{t.posts.publishRealms}</FieldLabel>
						<UnitMultiPicker
							ariaLabel={t.posts.publishRealms}
							index="realms"
							maxValues={MaximumPostPublishRealmCount}
							onValuesChange={setPublishRealmIds}
							placeholder={t.ui.pickerPlaceholders.realm}
							removeLabel={t.posts.removePublishRealm}
							values={publishRealmIds}
						/>
						<FieldDescription>
							{t.posts.publishRealmsHint} {t.posts.publishRealmsLimit}
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>{t.engagement.scoreRealm}</FieldLabel>
						<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
							<ScoreRealmPicker
								onChange={(realm) => setSelectedScoreRealm(realm)}
								options={scoreRealmOptions}
								value={scoreRealm}
							/>
							{scoreRealm ? <RealmScoreContextLink realmId={scoreRealm.id} /> : null}
						</div>
						<FieldDescription>{t.engagement.reviewScoreRealmHint}</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>{t.posts.titleOptional}</FieldLabel>
						<Input maxLength={500} name="title" />
					</Field>
					<Field>
						<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
						<Textarea maxLength={2_000} name="summary" />
					</Field>
					<ScoreInput disabled={!scoreRealm} onChange={setScore} value={score} />
					<PortableTextEditor
						capabilities={spoilerPortableTextEditorCapabilities}
						label={t.ui.body}
						onChange={setBody}
						required
						value={body}
					/>
					<DraftContentLanguageField controller={language.controller} />
				</FieldGroup>
				{invalid ? (
					<p className="text-sm text-destructive" role="alert">
						{t.errors.invalid}
					</p>
				) : null}
				<RequestFailure error={defaultScoreRealm.error} fallback={t.ui.retryLater} />
				<RequestFailure error={create.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					disabled={!selectedTarget || !body.length || (score !== undefined && !scoreRealm)}
					isLoading={create.isPending}
					type="submit"
					variant="solid"
				>
					{t.ui.create}
				</Button>
			</form>
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}
