"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiRealmsByRealmId, usePostApiPosts } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	EntityPicker,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	PageHeading,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { writePortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { PostEditorFields } from "../components/post-editor-fields";
import { invalidatePostQueries } from "../query";
import { postHref } from "../url";

type PickedEntity = { id: string; label: string };

export function PostCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t, locale } = useTranslation(["posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPosts();
	const localizationLanguages = useLocalizationLanguages();
	const defaultRealm = useGetApiRealmsByRealmId(
		{
			path: { realmId: defaultRealmId ?? "" },
			query: { localizationLanguages },
		},
		{ query: { enabled: Boolean(defaultRealmId) } },
	);
	const [realm, setRealm] = useState<PickedEntity>();
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);

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
		create.mutate(
			{
				body: {
					title,
					language: toContentLanguage(locale.target),
					body: writePortableText(body),
					...(realm ? { realmId: realm.id } : {}),
					...(subject ? { subjectId: subject.id } : {}),
				},
			},
			{
				onSuccess: async (post) => {
					await invalidatePostQueries(queryClient, post.id);
					router.push(postHref(post.id, realm?.id));
				},
			},
		);
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.posts.createTitle} />
				<form onSubmit={submit}>
					<FieldGroup>
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
			</main>
		</RequireSession>
	);
}
