"use client";

import { toContentLanguage } from "@rezics/i18n";
import { usePostApiReviews } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button, EntityPicker, Field, FieldGroup, FieldLabel, Input, Textarea } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { optionalPostLocalizationText } from "@/features/posts/model/post-localization-input";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { invalidateReviews } from "../data/review-cache";
import { useDefaultScoreContext } from "../data/default-score-context";
import { ScoreInput } from "./score-input";

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
	const { locale, t } = useTranslation(["engagement", "errors", "posts", "ui"]);
	const [target, setTarget] = useState<ReviewComposerTarget>();
	const [realm, setRealm] = useState<ReviewComposerTarget>();
	const [score, setScore] = useState<number>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);
	const defaultScoreContext = useDefaultScoreContext();
	const selectedTarget = fixedTarget ?? target;
	const scoreContext = realm ?? defaultScoreContext.context;
	const rulesAcknowledgement = useRealmRulesAcknowledgement(realm?.id);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		if (!selectedTarget || !body.length || (score !== undefined && !scoreContext)) {
			setInvalid(true);
			return;
		}
		const form = new FormData(formElement);
		const title = optionalPostLocalizationText(form, "title");
		const summary = optionalPostLocalizationText(form, "summary");
		setInvalid(false);
		const selectedRealm = realm;
		try {
			await rulesAcknowledgement.run(async () => {
				const result = await create.mutateAsync({
					body: {
						targetId: selectedTarget.id,
						...(progressEntryId ? { progressEntryId } : {}),
						...(selectedRealm ? { realmId: selectedRealm.id } : {}),
						...(score !== undefined && scoreContext
							? { score: { contextUnitId: scoreContext.id, value: score } }
							: {}),
						language: toContentLanguage(locale.target),
						...(title ? { title } : {}),
						...(summary ? { summary } : {}),
						body: writePortableText(body),
					},
				});
				await invalidateReviews(
					queryClient,
					result.id,
					selectedTarget.id,
					score !== undefined ? scoreContext?.id : undefined,
				);
				await onCreated(result.id);
				formElement.reset();
				setBody([]);
				setScore(undefined);
				setRealm(undefined);
				if (!fixedTarget) setTarget(undefined);
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					{progressEntryId ? (
						<p className="rounded-lg bg-primary/8 px-4 py-3 text-sm">
							{t.engagement.progressJournal.reviewBindingNotice}
						</p>
					) : null}
					{fixedTarget ? null : (
						<Field required>
							<FieldLabel>{t.engagement.reviewTarget}</FieldLabel>
							<EntityPicker index="units" onChange={setTarget} value={target} />
						</Field>
					)}
					<Field>
						<FieldLabel>{t.engagement.reviewRealm}</FieldLabel>
						<EntityPicker index="realms" onChange={setRealm} value={realm} />
						<p className="text-sm text-muted-foreground">
							{t.engagement.reviewScoreContextHint}
						</p>
					</Field>
					<Field>
						<FieldLabel>{t.posts.titleOptional}</FieldLabel>
						<Input maxLength={500} name="title" />
					</Field>
					<Field>
						<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
						<Textarea maxLength={2_000} name="summary" />
					</Field>
					<ScoreInput disabled={!scoreContext} onChange={setScore} value={score} />
					<PortableTextEditor
						label={t.ui.body}
						onChange={setBody}
						required
						value={body}
					/>
				</FieldGroup>
				{invalid ? (
					<p className="text-sm text-destructive" role="alert">
						{t.errors.invalid}
					</p>
				) : null}
				<RequestFailure error={defaultScoreContext.error} fallback={t.ui.retryLater} />
				<RequestFailure error={create.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					disabled={
						!selectedTarget || !body.length || (score !== undefined && !scoreContext)
					}
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
