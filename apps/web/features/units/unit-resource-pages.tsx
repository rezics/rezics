"use client";
import type { ContentLanguage } from "@rezics/i18n";

import {
	getApiEntitiesByUnitIdQueryKey,
	type GetApiEntitiesByUnitIdStatus200,
	useGetApiEntities,
	useGetApiEntitiesByUnitId,
	useGetApiTags,
	usePutApiEntitiesByUnitIdLocalizationsByLanguage,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";

import { type FormEvent } from "react";

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

import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorProvider } from "@/features/content-languages/hooks/use-content-language-editor";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
} from "@/features/content-languages/hooks/use-content-language-editor";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import {
	EntityLocalizationDraftCodec,
	type EntityLocalizationDraft,
} from "@/features/entities/model/entity-localization-draft";
import {
	studioSectionCreateHref,
	StudioTagCreateHref,
} from "@/features/create/model/studio-section";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetOption,
} from "@/features/media/components/localization-image-upload-field";
import {
	AvatarField,
	type AvatarFieldOption,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { readPortableText, writePortableText } from "@/lib/block";

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
		<UnitFrame title={t.entities.entities} createHref={studioSectionCreateHref("entity")}>
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
		"cover",
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
	const coverOptions: LocalizationImageAssetOption[] = entity.localizations.flatMap((entry) =>
		entry.language !== selectedLanguage && entry.cover
			? [{ ...entry.cover, label: t.locale.contentLanguages[entry.language] }]
			: [],
	);
	const draft = useLocalizedDraft<EntityLocalizationDraft>({
		scope: "entity-localization",
		baseVersion: entity.updatedAt,
		codec: EntityLocalizationDraftCodec,
		createInitialValue: () => ({
			title: localization?.title ?? "",
			summary: localization?.summary ?? "",
			description: readPortableText(localization?.description),
			avatar: localization?.avatar ?? null,
			banner: localization?.banner ?? null,
			cover: localization?.cover ?? null,
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
					description: writePortableText(value.description, localization?.description),
					avatar: avatarPresentationToInput(value.avatar),
					bannerAssetId: value.banner?.id ?? null,
					coverAssetId: value.cover?.id ?? null,
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
						<PortableTextEditor
							label={t.ui.description}
							onChange={(description) => draft.setValue((current) => ({ ...current, description }))}
							value={value.description}
						/>
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
							<FieldLabel>{t.cover.title}</FieldLabel>
							<LocalizationImageUploadField
								fallback={coverOptions[0] ?? null}
								onChange={(cover) => draft.setValue((current) => ({ ...current, cover }))}
								options={coverOptions}
								role="cover"
								value={value.cover}
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
