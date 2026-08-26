"use client";

import { usePostApiPosts } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	PageHeading,
	Textarea,
	UnitMultiPicker,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState, type FormEvent } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { writePortableText } from "@/lib/block";
import { PostEditorFields } from "../components/post-editor-fields";
import { optionalPostLocalizationText } from "../model/post-localization-input";
import { MaximumPostPublishRealmCount } from "../model/post-publication";
import { invalidatePostQueries } from "../query";
import { postHref } from "../url";

type PickedEntity = { id: string; label: string };

export function PostCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPosts();
	const [publishRealmIds, setPublishRealmIds] = useState<readonly string[]>(() =>
		defaultRealmId ? [defaultRealmId] : [],
	);
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [contentSpoilerLevel, setContentSpoilerLevel] = useState<0 | 1 | 2>(0);
	const [contentNsfw, setContentNsfw] = useState(false);
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement(publishRealmIds);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const data = new FormData(formElement);
		const title = optionalPostLocalizationText(data, "title");
		const summary = optionalPostLocalizationText(data, "summary");
		if (!body.length) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		const selectedPublishRealmIds = [...publishRealmIds];
		const selectedSubject = subject;
		try {
			await rulesAcknowledgement.run(async () => {
				const post = await create.mutateAsync({
					body: {
						...(title ? { title } : {}),
						...(summary ? { summary } : {}),
						postKind: "post",
						language: contentLanguage,
						body: writePortableText(body),
						contentSpoilerLevel,
						contentNsfw,
						publishRealmIds: selectedPublishRealmIds,
						...(selectedSubject ? { subjectId: selectedSubject.id } : {}),
					},
				});
				await invalidatePostQueries(queryClient, post.id);
				const contextRealmId =
					defaultRealmId && selectedPublishRealmIds.includes(defaultRealmId)
						? defaultRealmId
						: selectedPublishRealmIds[0];
				router.push(
					postHref(
						post.id,
						contextRealmId ? { kind: "realm", realmId: contextRealmId } : undefined,
					),
				);
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.posts.createTitle} />
				<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
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
								placeholder={t.ui.pickerPlaceholders.realm}
								removeLabel={t.posts.removePublishRealm}
								values={publishRealmIds}
							/>
							<FieldDescription>
								{t.posts.publishRealmsHint} {t.posts.publishRealmsLimit}
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel>{t.posts.subject}</FieldLabel>
							<EntityPicker
								ariaLabel={t.posts.subject}
								index="units"
								onChange={setSubject}
								placeholder={t.ui.pickerPlaceholders.unit}
								value={subject}
							/>
							{subject ? (
								<Button
									onClick={() => setSubject(undefined)}
									size="xs"
									type="button"
									variant="quiet"
								>
									{t.posts.clearSubject}
								</Button>
							) : null}
						</Field>
						<DraftContentLanguageField controller={language.controller} />
						<PostEditorFields
							body={body}
							contentSpoilerLevel={contentSpoilerLevel}
							contentNsfw={contentNsfw}
							error={create.error}
							onBodyChange={setBody}
							onContentSpoilerLevelChange={setContentSpoilerLevel}
							onContentNsfwChange={setContentNsfw}
							pending={create.isPending}
							submitLabel={t.posts.publish}
						/>
					</FieldGroup>
				</form>
				<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
			</main>
		</RequireSession>
	);
}
