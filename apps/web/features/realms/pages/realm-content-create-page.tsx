"use client";

import {
	type GetApiRealmsByRealmIdStatus200,
	useGetApiRealmsByRealmId,
	usePostApiPosts,
	usePostApiRealmsByRealmIdTagContexts,
	usePostApiRealmsByRealmIdWikis,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	Card,
	CardContent,
	EntityPicker,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	IdentityAvatar,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
	ToggleGroup,
	ToggleGroupItem,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenTextIcon, FileTextIcon, TagsIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { RequireSession } from "@/features/auth/require-session";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import { PostEditorFields } from "@/features/posts/components/post-editor-fields";
import { optionalPostLocalizationText } from "@/features/posts/model/post-localization-input";
import { invalidatePostQueries } from "@/features/posts/query";
import { postHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { writePortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { RealmRulesAcknowledgementPrompt } from "../components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "../hooks/use-realm-rules-acknowledgement";

import {
	getRealmContentComposerModes,
	isRealmContentComposerMode,
	RealmContentComposerDefaultMode,
	type RealmContentComposerMode,
} from "../model/realm-content-composer";

type WikiAccessMode = "community_owned" | "restricted";
type PickedEntity = { readonly id: string; readonly label: string };

export function RealmContentCreatePage({ realmId }: { readonly realmId: string }) {
	return (
		<RequireSession>
			<RealmContentCreateContent realmId={realmId} />
		</RequireSession>
	);
}

function RealmContentCreateContent({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["errors", "realms"]);
	const localizationLanguages = useLocalizationLanguages();
	const [mode, setMode] = useState<RealmContentComposerMode>(RealmContentComposerDefaultMode);
	const realm = useGetApiRealmsByRealmId({
		path: { realmId },
		query: { localizationLanguages },
	});
	if (realm.isPending) return <QueryPending />;
	if (realm.isError || !realm.data)
		return <QueryFailure error={realm.error} retry={() => void realm.refetch()} />;
	if (!realm.data.capabilities.canCreateUnits)
		return (
			<p className="mx-auto max-w-2xl px-4 py-10 text-sm text-destructive">
				{t.errors.forbidden}
			</p>
		);
	const modes = getRealmContentComposerModes({
		tagVotingEnabled: realm.data.realmTagVotingEnabled,
		canManageTagContexts: realm.data.capabilities.canManageTagContexts,
	});
	const tagContextAvailable = modes.includes("tag-context");

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
			<div className="grid gap-2">
				<PageHeading title={t.realms.contentComposer.title} />
				<p className="text-muted-foreground text-sm">
					{t.realms.contentComposer.description}
				</p>
			</div>
			<RealmIdentityCard realm={realm.data} />
			<ToggleGroup
				aria-label={t.realms.contentComposer.modeLabel}
				className="flex w-full flex-wrap"
				multiple={false}
				onValueChange={({ value }) => {
					const next = value[0];
					if (next && isRealmContentComposerMode(next) && modes.includes(next))
						setMode(next);
				}}
				value={[mode]}
				variant="outline"
			>
				<ToggleGroupItem className="flex-1" value="post">
					<FileTextIcon aria-hidden="true" />
					{t.realms.contentComposer.modes.post}
				</ToggleGroupItem>
				<ToggleGroupItem className="flex-1" value="wiki">
					<BookOpenTextIcon aria-hidden="true" />
					{t.realms.contentComposer.modes.wiki}
				</ToggleGroupItem>
				{tagContextAvailable ? (
					<ToggleGroupItem className="flex-1" value="tag-context">
						<TagsIcon aria-hidden="true" />
						{t.realms.contentComposer.modes.tagContext}
					</ToggleGroupItem>
				) : null}
			</ToggleGroup>
			{mode === "post" ? (
				<RealmPostForm realmId={realmId} />
			) : mode === "wiki" ? (
				<RealmWikiForm realmId={realmId} />
			) : tagContextAvailable ? (
				<RealmTagContextForm realmId={realmId} />
			) : null}
		</main>
	);
}

function RealmIdentityCard({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const localization = selectLocalization(realm.localizations, realm.language);
	const title = useChineseContentText(localization?.title ?? realm.id, localization?.language);
	return (
		<Card appearance="outlined">
			<CardContent className="flex items-center gap-3 p-4">
				<IdentityAvatar
					avatar={realm.avatar}
					fallback={Array.from(title)[0]?.toLocaleUpperCase() ?? title}
				/>
				<p className="min-w-0 truncate font-semibold">{title}</p>
			</CardContent>
		</Card>
	);
}

function RealmPostForm({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["posts"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPosts();
	const [body, setBody] = useState<PortableTextValue>([]);
	const language = useFormDraftContentLanguage(
		["title", "summary"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement([realmId]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!body.length) return;
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const title = optionalPostLocalizationText(form, "title");
		const summary = optionalPostLocalizationText(form, "summary");
		const contentLanguage = await language.resolveLanguage(formElement);
		try {
			await rulesAcknowledgement.run(async () => {
				const post = await create.mutateAsync({
					body: {
						...(title ? { title } : {}),
						...(summary ? { summary } : {}),
						postKind: "post",
						language: contentLanguage,
						body: writePortableText(body),
						publishRealmIds: [realmId],
					},
				});
				await invalidatePostQueries(queryClient, post.id);
				router.push(postHref(post.id, { kind: "realm", realmId }));
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
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
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}

function RealmWikiForm({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["posts", "realms", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiRealmsByRealmIdWikis();
	const [accessMode, setAccessMode] = useState<WikiAccessMode>("community_owned");
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const language = useFormDraftContentLanguage(
		["title"],
		portableTextDraftContentLanguageSample(body),
	);
	const rulesAcknowledgement = useRealmRulesAcknowledgement([realmId]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!body.length) return;
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const title = String(form.get("title") ?? "").trim();
		if (!title) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		try {
			await rulesAcknowledgement.run(async () => {
				const wiki = await create.mutateAsync({
					path: { realmId },
					body: {
						accessMode,
						title,
						body: writePortableText(body),
						language: contentLanguage,
						...(subject ? { subjectId: subject.id } : {}),
					},
				});
				await invalidatePostQueries(queryClient, wiki.id);
				router.push(postHref(wiki.id, { kind: "realm", realmId }));
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<WikiAccessModeField accessMode={accessMode} onChange={setAccessMode} />
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input maxLength={500} name="title" required />
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
						error={create.error}
						onBodyChange={setBody}
						pending={create.isPending}
						submitLabel={t.posts.publish}
					/>
				</FieldGroup>
			</form>
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}

function RealmTagContextForm({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["posts", "realms", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const create = usePostApiRealmsByRealmIdTagContexts();
	const [tag, setTag] = useState<PickedEntity>();
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

function WikiAccessModeField({
	accessMode,
	onChange,
}: {
	readonly accessMode: WikiAccessMode;
	readonly onChange: (value: WikiAccessMode) => void;
}) {
	const { t } = useTranslation(["posts", "realms"]);
	return (
		<Field required>
			<FieldLabel>{t.posts.wikiAccessMode}</FieldLabel>
			<NativeSelect
				onChange={(event) =>
					onChange(
						event.currentTarget.value === "restricted"
							? "restricted"
							: "community_owned",
					)
				}
				value={accessMode}
			>
				<NativeSelectOption value="community_owned">
					{t.posts.wikiCommunityUnit}
				</NativeSelectOption>
				<NativeSelectOption value="restricted">{t.posts.wikiRestricted}</NativeSelectOption>
			</NativeSelect>
			<FieldDescription>
				{accessMode === "community_owned"
					? t.realms.contentComposer.communityEditableDescription
					: t.realms.contentComposer.restrictedDescription}
			</FieldDescription>
		</Field>
	);
}
