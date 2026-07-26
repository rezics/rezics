"use client";
import { toContentLanguage } from "@rezics/i18n";

import {
	getApiEntitiesQueryKey,
	getApiEntitiesByUnitIdQueryKey,
	getApiTagsQueryKey,
	type GetApiEntitiesByUnitIdStatus200,
	useGetApiEntities,
	useGetApiEntitiesByUnitId,
	useGetApiTags,
	usePostApiEntities,
	usePostApiTags,
	usePutApiEntitiesByUnitIdLocalizationsByLanguage,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Banner, PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { UnitList } from "@rezics/ui";
import { IdentityAvatar } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
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
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { profileHref } from "@/features/profiles/profile-route";

function CatalogFrame({
	title,
	createHref,
	children,
}: {
	title: string;
	createHref?: string;
	children: React.ReactNode;
}) {
	const { t } = useTranslation(["actions", "catalog", "errors", "governance", "media", "ui"]);
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

export function EntitiesPage() {
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const query = useGetApiEntities({
		query: { language: toContentLanguage(locale.target), limit: 50 },
	});
	return (
		<CatalogFrame title={t.catalog.entities} createHref="/entities/new">
			<UnitList
				items={query.data?.items}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/entities/${item.id}`}
			/>
		</CatalogFrame>
	);
}

export function TagsPage() {
	const { t } = useTranslation(["actions", "catalog", "errors", "governance", "media", "ui"]);
	const query = useGetApiTags({ query: { limit: 50 } });
	return (
		<CatalogFrame title={t.catalog.tags} createHref="/tags/new">
			<UnitList
				items={query.data?.items}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/tags/${item.id}`}
			/>
		</CatalogFrame>
	);
}

export function EntityDetailPage({ id }: { id: string }) {
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const query = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { language: toContentLanguage(locale.target) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const localization = selectLocalization(
		query.data.localizations,
		toContentLanguage(locale.target),
	);
	const avatar = localization?.avatar ?? query.data.avatar;
	const banner = localization?.banner ?? query.data.banner;
	return (
		<CatalogFrame title={localization?.title ?? t.ui.unnamed}>
			{banner ? (
				<Banner alt="" className="rounded-2xl bg-muted" priority src={banner.url} />
			) : null}
			<Card>
				<CardContent className="grid gap-3 p-5 text-sm">
					<IdentityAvatar
						avatar={avatar}
						className="size-20"
						fallback={(localization?.title ?? t.ui.unnamed).slice(0, 1).toUpperCase()}
					/>
					<p>
						<span className="text-muted-foreground">{t.catalog.kind}</span>{" "}
						{query.data.kind}
					</p>
					<p>
						<span className="text-muted-foreground">{t.catalog.verification}</span>{" "}
						{query.data.verified ? t.catalog.verified : t.catalog.unverified}
					</p>
					{query.data.owner ? (
						<p>
							<span className="text-muted-foreground">{t.catalog.owner}</span>{" "}
							<Link
								className="underline underline-offset-4"
								href={profileHref({
									id: query.data.owner.id,
									slugAddress: query.data.owner.slugAddress,
								})}
							>
								{query.data.owner.title ?? t.ui.unnamed}
							</Link>
						</p>
					) : null}
					{localization?.summary && <p>{localization.summary}</p>}
					{query.data.capabilities.canEdit ? (
						<Button variant="solid" asChild className="w-fit">
							<Link href={`/entities/${query.data.id}/edit`}>{t.ui.edit}</Link>
						</Button>
					) : null}
					{query.data.capabilities.canManageAccess ||
					query.data.capabilities.canManageCreditAssociations ||
					query.data.capabilities.canManageSubjectAssociations ? (
						<Button asChild className="w-fit" variant="outline">
							<Link href={`/entities/${query.data.id}/governance`}>
								{t.governance.open}
							</Link>
						</Button>
					) : null}
				</CardContent>
			</Card>
		</CatalogFrame>
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
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const query = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { language: toContentLanguage(locale.target) },
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
		<EntityLocalizationForm
			key={`${query.data.id}:${toContentLanguage(locale.target)}:${query.data.updatedAt}`}
			entity={query.data}
		/>
	);
}

function EntityLocalizationForm({ entity }: { entity: GetApiEntitiesByUnitIdStatus200 }) {
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const localization = entity.localizations.find(
		(entry) => entry.language === toContentLanguage(locale.target),
	);
	const fallbackLocalization = selectLocalization(
		entity.localizations,
		toContentLanguage(locale.target),
		entity.localizations[0]?.language,
	);
	const avatarOptions: AvatarFieldOption[] = entity.localizations.flatMap((entry) =>
		entry.language !== toContentLanguage(locale.target) && entry.avatar
			? [{ ...entry.avatar, label: entry.language }]
			: [],
	);
	const bannerOptions: LocalizationImageAssetOption[] = entity.localizations.flatMap((entry) =>
		entry.language !== toContentLanguage(locale.target) && entry.banner
			? [{ ...entry.banner, label: entry.language }]
			: [],
	);
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(localization?.avatar ?? null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(
		localization?.banner ?? null,
	);
	const update = usePutApiEntitiesByUnitIdLocalizationsByLanguage();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await update.mutateAsync({
				path: { unitId: entity.id, language: toContentLanguage(locale.target) },
				body: {
					title: String(form.get("title") ?? "").trim(),
					summary: String(form.get("summary") ?? "").trim(),
					avatar: avatarPresentationToInput(avatar),
					bannerAssetId: banner?.id ?? null,
				},
			});
			await queryClient.invalidateQueries({
				queryKey: getApiEntitiesByUnitIdQueryKey({
					path: { unitId: entity.id },
					query: { language: toContentLanguage(locale.target) },
				}),
			});
			router.push(`/entities/${entity.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<CreateFrame title={t.catalog.entities}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input
							defaultValue={localization?.title ?? fallbackLocalization?.title ?? ""}
							maxLength={500}
							name="title"
							required
						/>
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea
							defaultValue={
								localization?.summary ?? fallbackLocalization?.summary ?? ""
							}
							maxLength={2000}
							name="summary"
						/>
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField
							fallback={avatarOptions[0] ?? null}
							onChange={setAvatar}
							options={avatarOptions}
							value={avatar}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField
							fallback={bannerOptions[0] ?? null}
							onChange={setBanner}
							options={bannerOptions}
							role="banner"
							value={banner}
						/>
					</Field>
					<RequestFailure error={update.error} />
					<Button
						variant="solid"
						className="w-fit"
						isLoading={update.isPending}
						type="submit"
					>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}

function CreateFrame({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={title} />
				{children}
			</main>
		</RequireSession>
	);
}

export function EntityCreatePage() {
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [error, setError] = useState(false);
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(null);
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
		const form = new FormData(event.currentTarget);
		try {
			await create.mutateAsync({
				body: {
					kind: String(form.get("kind") ?? "person"),
					localization: {
						language: toContentLanguage(locale.target),
						title: String(form.get("title") ?? "").trim(),
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
		<CreateFrame title={t.catalog.newEntity}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input name="title" required maxLength={500} />
					</Field>
					<Field required>
						<FieldLabel>{t.catalog.kind}</FieldLabel>
						<NativeSelect name="kind" defaultValue="person">
							<NativeSelectOption value="person">{t.ui.person}</NativeSelectOption>
							<NativeSelectOption value="organization">
								{t.ui.organization}
							</NativeSelectOption>
							<NativeSelectOption value="character">
								{t.ui.character}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea name="summary" maxLength={2000} />
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField onChange={setAvatar} value={avatar} />
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField
							onChange={setBanner}
							role="banner"
							value={banner}
						/>
					</Field>
					{error && <p className="text-destructive text-sm">{t.ui.retryLater}</p>}
					<Button variant="solid" type="submit" isLoading={create.isPending}>
						{t.ui.submit}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}

export function TagCreatePage() {
	const { t, locale } = useTranslation([
		"actions",
		"catalog",
		"errors",
		"governance",
		"media",
		"ui",
	]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [error, setError] = useState(false);
	const create = usePostApiTags({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: getApiTagsQueryKey() });
				router.push("/tags");
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(false);
		const form = new FormData(event.currentTarget);
		try {
			await create.mutateAsync({
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title: String(form.get("title") ?? "").trim(),
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
		<CreateFrame title={t.catalog.newTag}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input name="title" required maxLength={500} />
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea name="summary" maxLength={2000} />
					</Field>
					{error && <p className="text-destructive text-sm">{t.ui.retryLater}</p>}
					<Button variant="solid" type="submit" isLoading={create.isPending}>
						{t.ui.submit}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}
