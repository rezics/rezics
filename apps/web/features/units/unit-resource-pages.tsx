"use client";
import type { ContentLanguage } from "@rezics/i18n";

import {
	getApiEntitiesQueryKey,
	getApiEntitiesByUnitIdQueryKey,
	type GetApiEntitiesByUnitIdStatus200,
	useGetApiEntities,
	useGetApiEntitiesByUnitId,
	useGetApiTags,
	usePostApiEntities,
	usePutApiEntitiesByUnitIdLocalizationsByLanguage,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { CommunityUnitSearchPrompt } from "@/features/create/components/community-unit-search-prompt";
import {
	entityCommunityUnitSearchSubject,
	isCommunityUnitEntityKind,
	type CommunityUnitEntityKind,
} from "@/features/create/model/community-unit-search";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenIcon } from "lucide-react";

import { Cover, PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { UnitList, type UnitListItem as UiUnitListItem } from "@rezics/ui";
import { IdentityAvatar } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@rezics/ui";
import { LinkBox, LinkOverlay } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorProvider } from "@/features/content-languages/hooks/use-content-language-editor";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftAvatar,
	decodeDraftImageAsset,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { StudioTagCreateHref } from "@/features/create/model/studio-section";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import {
	AvatarField,
	type AvatarFieldOption,
	type AvatarFieldValue,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

type EntityLocalizationDraft = {
	readonly title: string;
	readonly summary: string;
	readonly avatar: AvatarFieldValue | null;
	readonly banner: LocalizationImageAssetValue | null;
};

const EntityLocalizationDraftCodec: LocalizedDraftCodec<EntityLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const avatar = decodeDraftAvatar(value.avatar);
		const banner = decodeDraftImageAsset(value.banner);
		return title === undefined ||
			summary === undefined ||
			avatar === undefined ||
			banner === undefined
			? undefined
			: { title, summary, avatar, banner };
	},
};

function UnitFrame({
	title,
	createHref,
	children,
}: {
	title: string;
	createHref?: string;
	children: React.ReactNode;
}) {
	const { t } = useTranslation(["actions", "entities", "errors", "governance", "media", "ui"]);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={title}
				action={
					createHref ? (
						<Button variant="solid" asChild>
							<Link href={createHref}>{t.actions.create}</Link>
						</Button>
					) : undefined
				}
			/>
			{children}
		</main>
	);
}

interface LocalizedUnitListItem extends UiUnitListItem {
	readonly language: ContentLanguage;
}

function ResourceList<Item extends LocalizedUnitListItem>({
	error,
	href,
	items,
	pending,
}: {
	readonly error: boolean;
	readonly href: (item: Item) => string;
	readonly items: readonly Item[] | undefined;
	readonly pending: boolean;
}) {
	if (pending || error || !items?.length) {
		return <UnitList error={error} items={items} pending={pending} />;
	}
	return (
		<ItemGroup className="gap-0 overflow-hidden rounded-2xl bg-background">
			{items.map((item) => (
				<ResourceListItem href={href(item)} item={item} key={item.id} />
			))}
		</ItemGroup>
	);
}

function ResourceListItem({
	href,
	item,
}: {
	readonly href: string;
	readonly item: LocalizedUnitListItem;
}) {
	const { t } = useTranslation("ui");
	const title = useChineseContentText(item.title ?? t.unnamed, item.title ? item.language : null);
	const summary = useChineseContentText(item.summary ?? "", item.language);
	const usesAvatar = Boolean(item.avatar);
	return (
		<LinkBox>
			<Item
				className="rounded-none border-0 border-b border-border-weak shadow-none last:border-b-0 hover:bg-surface-hover focus-within:bg-surface-hover"
				role="listitem"
			>
				{usesAvatar ? (
					<ItemMedia variant="icon">
						<IdentityAvatar
							avatar={item.avatar}
							className="size-14 text-lg font-black"
							fallback={title.slice(0, 1)}
						/>
					</ItemMedia>
				) : (
					<Cover
						alt={title}
						className="w-14 shrink-0 self-stretch rounded-md"
						fallback={<BookOpenIcon aria-hidden className="size-5" />}
						src={item.cover?.url}
					/>
				)}
				<ItemContent className="min-w-0 justify-center">
					<ItemTitle>
						<LinkOverlay href={href}>{title}</LinkOverlay>
					</ItemTitle>
					{summary ? <ItemDescription>{summary}</ItemDescription> : null}
				</ItemContent>
			</Item>
		</LinkBox>
	);
}

export function EntitiesPage() {
	const { t } = useTranslation(["actions", "entities", "errors", "governance", "media", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiEntities({
		query: { localizationLanguages, limit: 50 },
	});
	return (
		<UnitFrame title={t.entities.entities} createHref="/entities/new">
			<ResourceList
				items={query.data?.items}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/entities/${item.id}`}
			/>
		</UnitFrame>
	);
}

export function TagsPage() {
	const { t } = useTranslation(["actions", "entities", "errors", "governance", "media", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTags({ query: { localizationLanguages, limit: 50 } });
	return (
		<UnitFrame title={t.entities.tags} createHref={StudioTagCreateHref}>
			<ResourceList
				items={query.data?.items}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/tags/${item.id}`}
			/>
		</UnitFrame>
	);
}

export function EntityEditPage({ id }: { id: string }) {
	return (
		<RequireSession>
			<EntityEditContent id={id} />
		</RequireSession>
	);
}

function EntityEditContent({ id }: { id: string }) {
	const { t } = useTranslation(["actions", "entities", "errors", "governance", "media", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { localizationLanguages },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-2xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return (
		<ContentLanguageEditorProvider
			localizations={query.data.localizations}
			onLanguagesChanged={async () => {
				await query.refetch();
			}}
			unitId={query.data.id}
		>
			<EntityLocalizationEditor entity={query.data} />
		</ContentLanguageEditorProvider>
	);
}

function EntityLocalizationEditor({ entity }: { entity: GetApiEntitiesByUnitIdStatus200 }) {
	const { selectedLanguage } = useContentLanguageEditor();
	return (
		<EntityLocalizationForm
			entity={entity}
			key={`${entity.id}:${selectedLanguage}:${entity.updatedAt}`}
		/>
	);
}

function EntityLocalizationForm({ entity }: { entity: GetApiEntitiesByUnitIdStatus200 }) {
	const { t } = useTranslation([
		"actions",
		"entities",
		"errors",
		"governance",
		"locale",
		"media",
		"ui",
	]);
	const { selectedLanguage, languagesChanged } = useContentLanguageEditor();
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const localization = entity.localizations.find((entry) => entry.language === selectedLanguage);
	const avatarOptions: AvatarFieldOption[] = entity.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.avatar
			? [{ ...entry.avatar, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const bannerOptions: LocalizationImageAssetOption[] = entity.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.banner
			? [{ ...entry.banner, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const draft = useLocalizedDraft<EntityLocalizationDraft>({
		scope: "entity-localization",
		baseVersion: entity.updatedAt,
		codec: EntityLocalizationDraftCodec,
		createInitialValue: () => ({
			title: localization?.title ?? "",
			summary: localization?.summary ?? "",
			avatar: localization?.avatar ?? null,
			banner: localization?.banner ?? null,
		}),
	});
	const { value } = draft;
	const update = usePutApiEntitiesByUnitIdLocalizationsByLanguage();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await update.mutateAsync({
				path: { unitId: entity.id, language: selectedLanguage },
				body: {
					title: value.title.trim(),
					summary: value.summary.trim(),
					avatar: avatarPresentationToInput(value.avatar),
					bannerAssetId: value.banner?.id ?? null,
				},
			});
			draft.commit();
			await languagesChanged();
			await queryClient.invalidateQueries({
				queryKey: getApiEntitiesByUnitIdQueryKey({
					path: { unitId: entity.id },
					query: { localizationLanguages },
				}),
			});
			router.push(`/entities/${entity.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<CreateFrame action={<ContentLanguageControl />} title={t.entities.entities}>
			<LocalizationMediaFallbackNotice />
			<LocalizedDraftGate
				hydrated={draft.hydrated}
				onDiscard={draft.discard}
				serverChanged={draft.serverChanged}
			>
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input
								maxLength={500}
								name="title"
								onChange={(event) => {
									const title = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, title }));
								}}
								required
								value={value.title}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea
								maxLength={2000}
								name="summary"
								onChange={(event) => {
									const summary = event.currentTarget.value;
									draft.setValue((current) => ({ ...current, summary }));
								}}
								value={value.summary}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
							<AvatarField
								fallback={avatarOptions[0] ?? null}
								onChange={(avatar) => draft.setValue((current) => ({ ...current, avatar }))}
								options={avatarOptions}
								value={value.avatar}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
							<LocalizationImageUploadField
								fallback={bannerOptions[0] ?? null}
								onChange={(banner) => draft.setValue((current) => ({ ...current, banner }))}
								options={bannerOptions}
								role="banner"
								value={value.banner}
							/>
						</Field>
						<RequestFailure error={update.error} />
						<Button variant="solid" className="w-fit" isLoading={update.isPending} type="submit">
							{t.ui.save}
						</Button>
					</FieldGroup>
				</form>
			</LocalizedDraftGate>
		</CreateFrame>
	);
}

function CreateFrame({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading action={action} title={title} />
				{children}
			</main>
		</RequireSession>
	);
}

export function EntityCreatePage() {
	const { t } = useTranslation([
		"actions",
		"entities",
		"create",
		"errors",
		"governance",
		"media",
		"ui",
		"units",
	]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const [title, setTitle] = useState(() => searchParams.get("title") ?? "");
	const [searchConfirmed, setSearchConfirmed] = useState(false);
	const [kind, setKind] = useState<CommunityUnitEntityKind>(() => {
		const candidate = searchParams.get("kind");
		return isCommunityUnitEntityKind(candidate) ? candidate : "person";
	});
	const searchSubject = entityCommunityUnitSearchSubject(kind);
	const [error, setError] = useState(false);
	const [ownershipMode, setOwnershipMode] = useState<"profile_owned" | "community_owned">(() =>
		searchParams.get("ownershipMode") === "community_owned" ? "community_owned" : "profile_owned",
	);
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(null);
	const language = useFormDraftContentLanguage(["title", "summary"]);
	const create = usePostApiEntities({
		mutation: {
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({ queryKey: getApiEntitiesQueryKey() });
				router.push(`/entities/${result.id}`);
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(false);
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const submittedTitle = String(form.get("title") ?? "").trim();
		if (ownershipMode === "community_owned" && !searchConfirmed) return;
		const contentLanguage = await language.resolveLanguage(formElement);
		try {
			await create.mutateAsync({
				body: {
					ownershipMode,
					kind,
					localization: {
						language: contentLanguage,
						title: submittedTitle,
						avatar: avatarPresentationToInput(avatar),
						bannerAssetId: banner?.id ?? null,
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary")).trim() }
							: {}),
					},
				},
			});
		} catch {
			setError(true);
		}
	}
	return (
		<CreateFrame title={t.entities.newEntity}>
			<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.units.creation.entryOwnershipLabel}</FieldLabel>
						<NativeSelect
							name="ownershipMode"
							onChange={(event) =>
								setOwnershipMode(
									event.currentTarget.value === "community_owned"
										? "community_owned"
										: "profile_owned",
								)
							}
							value={ownershipMode}
						>
							<NativeSelectOption value="profile_owned">
								{t.units.creation.ownedEntry}
							</NativeSelectOption>
							<NativeSelectOption value="community_owned">
								{t.units.creation.publicEntry}
							</NativeSelectOption>
						</NativeSelect>
						<p className="text-muted-foreground text-sm">
							{ownershipMode === "profile_owned"
								? t.units.creation.ownedEntryDescription
								: t.units.creation.publicEntryDescription}
						</p>
					</Field>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input
							maxLength={500}
							name="title"
							onChange={(event) => {
								setTitle(event.currentTarget.value);
								setSearchConfirmed(false);
							}}
							required
							value={title}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.entities.kind}</FieldLabel>
						<NativeSelect
							name="kind"
							onChange={(event) => {
								const candidate = event.currentTarget.value;
								if (isCommunityUnitEntityKind(candidate)) {
									setKind(candidate);
									setSearchConfirmed(false);
								}
							}}
							value={kind}
						>
							<NativeSelectOption value="person">{t.ui.person}</NativeSelectOption>
							<NativeSelectOption value="organization">{t.ui.organization}</NativeSelectOption>
							<NativeSelectOption value="character">{t.ui.character}</NativeSelectOption>
						</NativeSelect>
					</Field>
					{ownershipMode === "community_owned" ? (
						<CommunityUnitSearchPrompt
							confirmed={searchConfirmed}
							onConfirmedChange={setSearchConfirmed}
							query={title}
							subject={searchSubject}
						/>
					) : null}
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea name="summary" maxLength={2000} />
					</Field>
					<DraftContentLanguageField controller={language.controller} />
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField onChange={setAvatar} value={avatar} />
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField onChange={setBanner} role="banner" value={banner} />
					</Field>
					{error && <p className="text-destructive text-sm">{t.ui.retryLater}</p>}
					<Button
						disabled={ownershipMode === "community_owned" && !searchConfirmed}
						variant="solid"
						type="submit"
						isLoading={create.isPending}
					>
						{t.ui.submit}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}
