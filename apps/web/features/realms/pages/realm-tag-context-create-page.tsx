"use client";

import { toContentLanguage } from "@rezics/i18n";
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
type WikiAccessMode = "public_entry" | "restricted";

export function RealmTagContextCreatePage({ realmId }: { readonly realmId: string }) {
	const { locale, t } = useTranslation(["posts", "realms", "ui"]);
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
	const rulesAcknowledgement = useRealmRulesAcknowledgement(realmId);
	const realmLocalization = realm.data
		? selectLocalization(realm.data.localizations, realm.data.language)
		: undefined;
	const realmTitle = useChineseContentText(
		realmLocalization?.title ?? realmId,
		realmLocalization?.language,
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!tag || !body.length) return;
		const form = new FormData(event.currentTarget);
		const title = String(form.get("title") ?? "").trim();
		const summary = String(form.get("summary") ?? "").trim();
		if (!title || !summary) return;
		void rulesAcknowledgement
			.run(async () => {
				const context = await create.mutateAsync({
					path: { realmId },
					body: {
						tagId: tag.id,
						accessMode,
						title,
						summary,
						body: writePortableText(body),
						language: toContentLanguage(locale.target),
					},
				});
				await invalidatePostQueries(queryClient, context.contextPostId);
				router.push(
					postHref(context.contextPostId, {
						kind: "realm",
						realmId,
					}),
				);
			})
			.catch(() => undefined);
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
					<form onSubmit={submit}>
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
								<EntityPicker index="tags" onChange={setTag} value={tag} />
							</Field>
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
							</Field>
							<Field required>
								<FieldLabel>{t.ui.title}</FieldLabel>
								<Input maxLength={500} name="title" required />
							</Field>
							<Field required>
								<FieldLabel>{t.ui.summary}</FieldLabel>
								<Textarea maxLength={2_000} name="summary" required />
							</Field>
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
