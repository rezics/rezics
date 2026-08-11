"use client";

import {
	getApiRealmsByRealmIdTagContextsQueryKey,
	usePostApiRealmsByRealmIdTagContexts,
	usePutApiRealmsByRealmIdTagsByTagIdContext,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
	Textarea,
	type EntityPickerValue,
	type EntitySearch,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent } from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import { PostEditorFields } from "@/features/posts/components/post-editor-fields";
import { invalidatePostQueries } from "@/features/posts/query";
import { postHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { writePortableText } from "@/lib/block";
import {
	RealmTagContextPostKinds,
	searchRealmMountedPosts,
} from "../data/realm-mounted-post-search";
import { useRealmRulesAcknowledgement } from "../hooks/use-realm-rules-acknowledgement";
import {
	getRealmTagContextComposerIntents,
	isRealmTagContextComposerIntent,
	type RealmTagContextComposerIntent,
} from "../model/realm-tag-context-composer";
import { RealmRulesAcknowledgementPrompt } from "./realm-rules-acknowledgement-prompt";
import { WikiAccessModeField, type WikiAccessMode } from "./wiki-access-mode-field";

export function RealmTagContextForm({
	realmId,
	canCreateWiki,
}: {
	readonly realmId: string;
	readonly canCreateWiki: boolean;
}) {
	const { t } = useTranslation("realms");
	const [selectedIntent, setSelectedIntent] = useState<RealmTagContextComposerIntent>();
	const intents = getRealmTagContextComposerIntents(canCreateWiki);
	const intent = selectedIntent && intents.includes(selectedIntent) ? selectedIntent : intents[0];
	return (
		<div className="grid gap-6">
			{intents.length > 1 ? (
				<Field>
					<RadioGroup
						onValueChange={({ value }) => {
							if (value && isRealmTagContextComposerIntent(value)) setSelectedIntent(value);
						}}
						value={intent}
					>
						<RadioGroupLabel>{t.tagContext.sourceLabel}</RadioGroupLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							<RadioGroupItem
								className="min-h-11 rounded-lg border border-input px-3 py-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary/8"
								value="create"
							>
								{t.tagContext.createNew}
							</RadioGroupItem>
							<RadioGroupItem
								className="min-h-11 rounded-lg border border-input px-3 py-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary/8"
								value="bind-existing"
							>
								{t.tagContext.useExisting}
							</RadioGroupItem>
						</div>
					</RadioGroup>
				</Field>
			) : null}
			{intent === "create" ? (
				<RealmTagContextCreateForm realmId={realmId} />
			) : (
				<RealmTagContextBindForm realmId={realmId} />
			)}
		</div>
	);
}

function RealmTagContextCreateForm({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["realms", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiRealmsByRealmIdTagContexts();
	const [tag, setTag] = useState<EntityPickerValue>();
	const [accessMode, setAccessMode] = useState<WikiAccessMode>("community_owned");
	const [body, setBody] = useState<PortableTextValue>([]);
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement([realmId]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!tag || !body.length) return;
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const title = String(form.get("title") ?? "").trim();
		const summary = String(form.get("summary") ?? "").trim();
		if (!title || !summary) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		try {
			await rulesAcknowledgement.run(async () => {
				const context = await create.mutateAsync({
					path: { realmId },
					body: {
						tagId: tag.id,
						accessMode,
						title,
						summary,
						body: writePortableText(body),
						language: contentLanguage,
					},
				});
				await invalidatePostQueries(queryClient, context.contextPostId);
				router.push(postHref(context.contextPostId, { kind: "realm", realmId }));
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.realms.tagContext.tag}</FieldLabel>
						<EntityPicker
							ariaLabel={t.realms.tagContext.tag}
							index="tags"
							onChange={setTag}
							onClear={() => setTag(undefined)}
							placeholder={t.ui.pickerPlaceholders.tag}
							value={tag}
						/>
					</Field>
					<WikiAccessModeField accessMode={accessMode} onChange={setAccessMode} />
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input maxLength={500} name="title" required />
					</Field>
					<Field required>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea maxLength={2_000} name="summary" required />
					</Field>
					<DraftContentLanguageField controller={language.controller} />
					<PostEditorFields
						body={body}
						error={create.error}
						onBodyChange={setBody}
						pending={create.isPending}
						submitLabel={t.realms.tagContext.publish}
					/>
				</FieldGroup>
			</form>
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}

function RealmTagContextBindForm({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["realms", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const bind = usePutApiRealmsByRealmIdTagsByTagIdContext();
	const [tag, setTag] = useState<EntityPickerValue>();
	const [wiki, setWiki] = useState<EntityPickerValue>();
	const search = useCallback<EntitySearch>(
		(_index, query, signal) =>
			searchRealmMountedPosts({
				realmId,
				query,
				signal,
				localizationLanguages,
				kinds: RealmTagContextPostKinds,
			}),
		[localizationLanguages, realmId],
	);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!tag || !wiki) return;
		try {
			const relationship = await bind.mutateAsync({
				path: { realmId, tagId: tag.id },
				body: { contextPostId: wiki.id },
			});
			await Promise.all([
				invalidatePostQueries(queryClient, relationship.contextPostId),
				queryClient.invalidateQueries({
					queryKey: getApiRealmsByRealmIdTagContextsQueryKey({ path: { realmId } }),
				}),
			]);
			router.push(postHref(relationship.contextPostId, { kind: "realm", realmId }));
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.realms.tagContext.tag}</FieldLabel>
					<EntityPicker
						ariaLabel={t.realms.tagContext.tag}
						index="tags"
						onChange={setTag}
						onClear={() => setTag(undefined)}
						placeholder={t.ui.pickerPlaceholders.tag}
						value={tag}
					/>
					<FieldDescription>{t.realms.tagContext.bindExistingDescription}</FieldDescription>
				</Field>
				<Field required>
					<FieldLabel>{t.realms.tagContext.existingWiki}</FieldLabel>
					<EntityPicker
						ariaLabel={t.realms.tagContext.existingWiki}
						index="posts"
						kinds={RealmTagContextPostKinds}
						onChange={setWiki}
						onClear={() => setWiki(undefined)}
						placeholder={t.ui.pickerPlaceholders.post}
						search={search}
						value={wiki}
					/>
					<FieldDescription>{t.realms.tagContext.existingWikiHint}</FieldDescription>
				</Field>
				<RequestFailure error={bind.error} />
				<Button disabled={!tag || !wiki} isLoading={bind.isPending} type="submit" variant="solid">
					{t.realms.tagContext.bindExisting}
				</Button>
			</FieldGroup>
		</form>
	);
}
