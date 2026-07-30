"use client";

import { usePostApiPosts } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentProps, type FormEvent } from "react";

import {
	Button,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	Spinner,
	Textarea,
	UnitMultiPicker,
} from "@rezics/ui";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import {
	PortableTextEditor,
	preloadPortableTextEditor,
} from "@/features/editor/portable-text-editor";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { optionalPostLocalizationText } from "./model/post-localization-input";
import { MaximumPostPublishRealmCount } from "./model/post-publication";
import { invalidatePostQueries } from "./query";

const editorPreloadIntentHandlers = {
	onFocus: preloadPortableTextEditor,
	onPointerDown: preloadPortableTextEditor,
	onPointerEnter: preloadPortableTextEditor,
} satisfies Pick<ComponentProps<"button">, "onFocus" | "onPointerDown" | "onPointerEnter">;

export function SubjectPostComposer({
	onCreated,
	postKind,
	subjectId,
}: {
	onCreated?: (postId: string) => void | Promise<void>;
	postKind: "post" | "excerpt";
	subjectId: string;
}) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const create = usePostApiPosts();
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [publishRealmIds, setPublishRealmIds] = useState<readonly string[]>([]);
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement(publishRealmIds);

	useEffect(() => {
		if (expanded) return;
		const preload = () => preloadPortableTextEditor();
		if ("requestIdleCallback" in window) {
			const idleCallbackId = window.requestIdleCallback(preload, { timeout: 2_000 });
			return () => window.cancelIdleCallback(idleCallbackId);
		}
		const timeoutId = setTimeout(preload, 1_000);
		return () => clearTimeout(timeoutId);
	}, [expanded]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const title = optionalPostLocalizationText(form, "title");
		const summary = optionalPostLocalizationText(form, "summary");
		if (!body.length) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		const contentLanguage = await language.resolveLanguage(formElement);
		const selectedPublishRealmIds = [...publishRealmIds];
		try {
			await rulesAcknowledgement.run(async () => {
				const result = await create.mutateAsync({
					body: {
						...(title ? { title } : {}),
						...(summary ? { summary } : {}),
						postKind,
						language: contentLanguage,
						body: writePortableText(body),
						subjectId,
						publishRealmIds: selectedPublishRealmIds,
					},
				});
				await invalidatePostQueries(queryClient, result.id);
				formElement.reset();
				setPublishRealmIds([]);
				setBody([]);
				language.reset();
				setExpanded(false);
				await onCreated?.(result.id);
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			{expanded ? (
				<form
					className="grid gap-6"
					onInput={language.onInput}
					onSubmit={(event) => void submit(event)}
				>
					<FieldGroup>
						<Field>
							<FieldLabel>{t.posts.titleOptional}</FieldLabel>
							<Input maxLength={500} name="title" />
						</Field>
						<Field>
							<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
							<Textarea maxLength={2_000} name="summary" />
						</Field>
						<Field>
							<FieldLabel>{t.posts.publishRealms}</FieldLabel>
							<UnitMultiPicker
								ariaLabel={t.posts.publishRealms}
								index="realms"
								maxValues={MaximumPostPublishRealmCount}
								onValuesChange={setPublishRealmIds}
								removeLabel={t.posts.removePublishRealm}
								values={publishRealmIds}
							/>
							<FieldDescription>
								{t.posts.publishRealmsHint} {t.posts.publishRealmsLimit}
							</FieldDescription>
						</Field>
						<PortableTextEditor
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
					<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					<div className="flex flex-wrap gap-2">
						<Button
							className="w-fit"
							disabled={!body.length || create.isPending}
							type="submit"
							variant="solid"
						>
							{create.isPending ? <Spinner data-icon="inline-start" /> : null}
							{t.posts.publish}
						</Button>
						<Button onClick={() => setExpanded(false)} type="button" variant="quiet">
							{t.posts.cancel}
						</Button>
					</div>
				</form>
			) : (
				<button
					{...editorPreloadIntentHandlers}
					className="flex h-11 w-full items-center rounded-xl border border-input bg-background px-4 text-start text-muted-foreground text-sm shadow-sm/5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/32"
					onClick={() => {
						preloadPortableTextEditor();
						setExpanded(true);
					}}
					type="button"
				>
					{postKind === "excerpt"
						? t.posts.openExcerptComposer
						: t.posts.openDiscussionComposer}
				</button>
			)}
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}
