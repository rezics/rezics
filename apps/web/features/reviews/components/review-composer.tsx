"use client";

import { toContentLanguage } from "@rezics/i18n";
import { usePostApiReviews } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button, EntityPicker, Field, FieldGroup, FieldLabel, Input } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { invalidateReviews } from "../data/review-cache";
import { ScoreInput } from "./score-input";

export interface ReviewComposerTarget {
	readonly id: string;
	readonly label: string;
}

export function ReviewComposer({
	onCreated,
	target: fixedTarget,
}: {
	onCreated: (reviewId: string) => void | Promise<void>;
	target?: ReviewComposerTarget;
}) {
	const create = usePostApiReviews();
	const queryClient = useQueryClient();
	const { locale, t } = useTranslation(["engagement", "errors", "ui"]);
	const [target, setTarget] = useState<ReviewComposerTarget>();
	const [realm, setRealm] = useState<ReviewComposerTarget>();
	const [score, setScore] = useState<number>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);
	const selectedTarget = fixedTarget ?? target;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		if (!selectedTarget || !body.length || (score !== undefined && !realm)) {
			setInvalid(true);
			return;
		}
		const form = new FormData(formElement);
		const title = String(form.get("title") ?? "").trim();
		if (!title) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			const result = await create.mutateAsync({
				body: {
					targetId: selectedTarget.id,
					...(realm ? { realmId: realm.id } : {}),
					...(score !== undefined && realm
						? { score: { realmId: realm.id, value: score } }
						: {}),
					language: toContentLanguage(locale.target),
					title,
					...(String(form.get("summary") ?? "").trim()
						? { summary: String(form.get("summary") ?? "").trim() }
						: {}),
					body: writePortableText(body),
				},
			});
			await invalidateReviews(
				queryClient,
				result.id,
				selectedTarget.id,
				score !== undefined ? realm?.id : undefined,
			);
			await onCreated(result.id);
			formElement.reset();
			setBody([]);
			setScore(undefined);
			setRealm(undefined);
			if (!fixedTarget) setTarget(undefined);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
			<FieldGroup>
				{fixedTarget ? null : (
					<Field required>
						<FieldLabel>{t.engagement.reviewTarget}</FieldLabel>
						<EntityPicker index="units" onChange={setTarget} value={target} />
					</Field>
				)}
				<Field>
					<FieldLabel>{t.engagement.reviewRealm}</FieldLabel>
					<EntityPicker
						index="realms"
						onChange={(nextRealm) => {
							setRealm(nextRealm);
							if (!nextRealm) setScore(undefined);
						}}
						value={realm}
					/>
				</Field>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input maxLength={500} name="title" required />
				</Field>
				<Field>
					<FieldLabel>{t.ui.summary}</FieldLabel>
					<Input maxLength={2000} name="summary" />
				</Field>
				<ScoreInput disabled={!realm} onChange={setScore} value={score} />
				<PortableTextEditor label={t.ui.body} onChange={setBody} required value={body} />
			</FieldGroup>
			{invalid ? (
				<p className="text-sm text-destructive" role="alert">
					{t.errors.invalid}
				</p>
			) : null}
			<RequestFailure error={create.error} fallback={t.ui.retryLater} />
			<Button
				className="w-fit"
				disabled={!selectedTarget || !body.length || (score !== undefined && !realm)}
				isLoading={create.isPending}
				type="submit"
				variant="solid"
			>
				{t.ui.create}
			</Button>
		</form>
	);
}
