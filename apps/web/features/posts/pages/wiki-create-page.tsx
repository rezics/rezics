"use client";

import { usePostApiPostsWiki } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
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
import { invalidatePostQueries } from "../query";
import { postHref } from "../url";
import { MaximumPostPublishRealmCount } from "../model/post-publication";

type PickedEntity = { id: string; label: string };
type WikiAccessMode = "public_entry" | "restricted";

export function WikiCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPostsWiki();
	const [accessMode, setAccessMode] = useState<WikiAccessMode>("restricted");
	const [publishRealmIds, setPublishRealmIds] = useState<readonly string[]>(() =>
		defaultRealmId ? [defaultRealmId] : [],
	);
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const language = useFormDraftContentLanguage(
		["title"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement(publishRealmIds);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const data = new FormData(formElement);
		const title = String(data.get("title") ?? "").trim();
		if (!title || !body.length) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		const selectedPublishRealmIds = [...publishRealmIds];
		try {
			await rulesAcknowledgement.run(async () => {
				const wiki = await create.mutateAsync({
					body: {
						accessMode,
						title,
						language: contentLanguage,
						body: writePortableText(body),
						publishRealmIds: selectedPublishRealmIds,
						...(subject ? { subjectId: subject.id } : {}),
					},
				});
				await invalidatePostQueries(queryClient, wiki.id);
				const contextRealmId =
					defaultRealmId && selectedPublishRealmIds.includes(defaultRealmId)
						? defaultRealmId
						: selectedPublishRealmIds[0];
				router.push(
					postHref(
						wiki.id,
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
				<PageHeading title={t.posts.wikiCreateTitle} />
				<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.posts.wikiAccessMode}</FieldLabel>
							<NativeSelect
								onChange={(event) =>
									setAccessMode(
										event.currentTarget.value === "public_entry"
											? "public_entry"
											: "restricted",
									)
								}
								value={accessMode}
							>
								<NativeSelectOption value="restricted">
									{t.posts.wikiRestricted}
								</NativeSelectOption>
								<NativeSelectOption value="public_entry">
									{t.posts.wikiPublicEntry}
								</NativeSelectOption>
							</NativeSelect>
							<p className="text-muted-foreground text-sm">
								{accessMode === "public_entry"
									? t.posts.wikiPublicDescription
									: t.posts.wikiRestrictedDescription}
							</p>
						</Field>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
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
						<Field>
							<FieldLabel>{t.posts.subject}</FieldLabel>
							<EntityPicker index="units" onChange={setSubject} value={subject} />
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
							error={create.error}
							onBodyChange={setBody}
							pending={create.isPending}
							submitLabel={t.posts.publish}
						/>
					</FieldGroup>
				</form>
				<RealmRulesAcknowledgementPrompt
					controller={rulesAcknowledgement}
					intent="publish"
				/>
			</main>
		</RequireSession>
	);
}
