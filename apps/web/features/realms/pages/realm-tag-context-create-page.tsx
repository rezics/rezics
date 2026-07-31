"use client";

import {
	useGetApiRealmsByRealmId,
	usePostApiRealmsByRealmIdTagContexts,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	EntityPicker,
	Card,
	CardContent,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	IdentityAvatar,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { RequireSession } from "@/features/auth/require-session";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import { PostEditorFields } from "@/features/posts/components/post-editor-fields";
import { invalidatePostQueries } from "@/features/posts/query";
import { postHref } from "@/features/posts/url";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { writePortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";

type PickedTag = { readonly id: string; readonly label: string };
type WikiAccessMode = "community_owned" | "restricted";

export function RealmTagContextCreatePage({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["posts", "realms", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const realm = useGetApiRealmsByRealmId({
		path: { realmId },
		query: { localizationLanguages },
	});
	const create = usePostApiRealmsByRealmIdTagContexts();
	const [tag, setTag] = useState<PickedTag>();
	const [accessMode, setAccessMode] = useState<WikiAccessMode>("restricted");
	const [body, setBody] = useState<PortableTextValue>([]);
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement([realmId]);
	const realmLocalization = realm.data
		? selectLocalization(realm.data.localizations, realm.data.language)
		: undefined;
	const realmTitle = useChineseContentText(
		realmLocalization?.title ?? realmId,
		realmLocalization?.language,
	);

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
				router.push(
					postHref(context.contextPostId, {
						kind: "realm",
						realmId,
					}),
				);
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<RequireSession>
			{realm.isPending ? (
				<QueryPending />
			) : realm.isError || !realm.data ? (
				<QueryFailure error={realm.error} retry={() => void realm.refetch()} />
			) : (
				<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
					<PageHeading title={t.realms.tagContext.createTitle} />
					<p className="text-muted-foreground text-sm">
						{t.realms.tagContext.createDescription}
					</p>
					<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
						<FieldGroup>
							<Field>
								<FieldLabel>{t.posts.realm}</FieldLabel>
								<Card appearance="outlined">
									<CardContent className="flex items-center gap-3 p-4">
										<IdentityAvatar
											avatar={realm.data.avatar}
											fallback={
												Array.from(realmTitle)[0]?.toLocaleUpperCase() ??
												realmTitle
											}
										/>
										<p className="min-w-0 truncate font-semibold">
											{realmTitle}
										</p>
									</CardContent>
								</Card>
							</Field>
							<Field required>
								<FieldLabel>{t.realms.tagContext.tag}</FieldLabel>
								<EntityPicker
									ariaLabel={t.realms.tagContext.tag}
									index="tags"
									onChange={setTag}
									placeholder={t.ui.pickerPlaceholders.tag}
									value={tag}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.posts.wikiAccessMode}</FieldLabel>
								<NativeSelect
									onChange={(event) =>
										setAccessMode(
											event.currentTarget.value === "community_owned"
												? "community_owned"
												: "restricted",
										)
									}
									value={accessMode}
								>
									<NativeSelectOption value="restricted">
										{t.posts.wikiRestricted}
									</NativeSelectOption>
									<NativeSelectOption value="community_owned">
										{t.posts.wikiCommunityUnit}
									</NativeSelectOption>
								</NativeSelect>
							</Field>
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
					<RealmRulesAcknowledgementPrompt
						controller={rulesAcknowledgement}
						intent="publish"
					/>
				</main>
			)}
		</RequireSession>
	);
}
