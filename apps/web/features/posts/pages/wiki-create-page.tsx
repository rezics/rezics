"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	useGetApiRealmsByRealmId,
	usePostApiPostsWiki,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	EntityPicker,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { writePortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { PostEditorFields } from "../components/post-editor-fields";
import { invalidatePostQueries } from "../query";
import { postHref } from "../url";

type PickedEntity = { id: string; label: string };
type WikiAccessMode = "public_entry" | "restricted";

export function WikiCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t, locale } = useTranslation(["posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPostsWiki();
	const localizationLanguages = useLocalizationLanguages();
	const defaultRealm = useGetApiRealmsByRealmId(
		{
			path: { realmId: defaultRealmId ?? "" },
			query: { localizationLanguages },
		},
		{ query: { enabled: Boolean(defaultRealmId) } },
	);
	const [accessMode, setAccessMode] = useState<WikiAccessMode>("restricted");
	const [realm, setRealm] = useState<PickedEntity>();
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const rulesAcknowledgement = useRealmRulesAcknowledgement(realm?.id);

	useEffect(() => {
		if (!defaultRealm.data || realm) return;
		const localization = selectLocalization(
			defaultRealm.data.localizations,
			defaultRealm.data.language,
			defaultRealm.data.language,
		);
		setRealm({
			id: defaultRealm.data.id,
			label: localization?.title ?? defaultRealm.data.id,
		});
	}, [defaultRealm.data, realm]);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		if (!title || !body.length) return;
		const selectedRealm = realm;
		void rulesAcknowledgement
			.run(async () => {
				const wiki = await create.mutateAsync({
					body: {
						accessMode,
						title,
						language: toContentLanguage(locale.target),
						body: writePortableText(body),
						...(selectedRealm ? { realmId: selectedRealm.id } : {}),
						...(subject ? { subjectId: subject.id } : {}),
					},
				});
				await invalidatePostQueries(queryClient, wiki.id);
				router.push(
					postHref(
						wiki.id,
						selectedRealm ? { kind: "realm", realmId: selectedRealm.id } : undefined,
					),
				);
			})
			.catch(() => undefined);
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.posts.wikiCreateTitle} />
				<form onSubmit={submit}>
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
							<FieldLabel>{t.posts.realm}</FieldLabel>
							<EntityPicker index="realms" onChange={setRealm} value={realm} />
							{realm ? (
								<Button
									onClick={() => setRealm(undefined)}
									size="xs"
									type="button"
									variant="quiet"
								>
									{t.posts.clearRealm}
								</Button>
							) : null}
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
