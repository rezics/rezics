"use client";

import {
	getApiUsersByIdQueryKey,
	getApiUsersMePreferencesQueryKey,
	getApiUsersMeQueryKey,
	useGetApiUsersMe,
	useGetApiUsersMePreferences,
	usePatchApiUsersMe,
	usePutApiUsersMePreferences,
	useReplaceOwnProfileSlugAddress,
	type GetApiUsersMeStatus200,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Checkbox, CheckboxGroup } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { isContentLanguage, isStoredUiLocale, toUiLocale } from "@rezics/i18n";
import { RequireSession } from "@/features/auth/require-session";
import { SlugAddressForm } from "@/features/slugs/slug-address-form";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/units/localization-image-upload-field";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";

function SettingsFrame({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={title} />
				{children}
			</main>
		</RequireSession>
	);
}

const ContentRatings = ["general", "r15", "r18", "r18g"] as const;
type ContentRating = (typeof ContentRatings)[number];

function isContentRating(value: FormDataEntryValue): value is ContentRating {
	return typeof value === "string" && ContentRatings.some((rating) => rating === value);
}

export function ProfileSettings() {
	const profile = useGetApiUsersMe();
	if (profile.isPending) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	return <ProfileSettingsForm key={profile.data.updatedAt} current={profile.data} />;
}

function ProfileSettingsForm({ current }: { current: GetApiUsersMeStatus200 }) {
	const { t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const queryClient = useQueryClient();
	const update = usePatchApiUsersMe({
		mutation: {
			onSuccess: (profile) =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: getApiUsersMeQueryKey() }),
					queryClient.invalidateQueries({
						queryKey: getApiUsersByIdQueryKey({ path: { id: profile.id } }),
					}),
				]),
		},
	});
	const replaceSlug = useReplaceOwnProfileSlugAddress({
		mutation: {
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: getApiUsersMeQueryKey() }),
					queryClient.invalidateQueries({
						queryKey: getApiUsersByIdQueryKey({ path: { id: current.id } }),
					}),
				]),
		},
	});
	const [saved, setSaved] = useState(false);
	const [avatar, setAvatar] = useState<LocalizationImageAssetValue | null>(current.avatar);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(current.banner);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		const data = new FormData(event.currentTarget);
		const name = String(data.get("name") ?? "").trim();
		try {
			await update.mutateAsync({
				body: {
					updatedAt: current.updatedAt,
					...(name ? { name } : {}),
					summary: String(data.get("summary") ?? "").trim(),
					avatarAssetId: avatar?.id ?? null,
					bannerAssetId: banner?.id ?? null,
				},
			});
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame title={t.settings.profile}>
			<Button asChild className="w-fit" variant="outline">
				<Link href="/settings/invitations">{t.governance.receivedInvitations}</Link>
			</Button>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<LocalizationImageUploadField
							onChange={setAvatar}
							role="avatar"
							shape="avatar"
							value={avatar}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField
							onChange={setBanner}
							role="banner"
							shape="banner"
							value={banner}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.ui.displayName}</FieldLabel>
						<Input name="name" defaultValue={current.name ?? ""} />
					</Field>
					<Field>
						<FieldLabel>{t.ui.introduction}</FieldLabel>
						<Textarea name="summary" defaultValue={current.summary ?? ""} />
					</Field>
					{saved && <p className="text-success-foreground text-sm">{t.ui.saved}</p>}
					<Button type="submit" isLoading={update.isPending}>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
			<Card>
				<CardContent className="p-5">
					<SlugAddressForm
						error={replaceSlug.error}
						initialSlug={current.slugAddress?.slug}
						isPending={replaceSlug.isPending}
						onSubmit={(slug) => replaceSlug.mutateAsync({ body: { slug } })}
					/>
				</CardContent>
			</Card>
		</SettingsFrame>
	);
}

export function PreferenceSettings() {
	const { t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const queryClient = useQueryClient();
	const preferences = useGetApiUsersMePreferences();
	const update = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMePreferencesQueryKey() }),
		},
	});
	const { setLocale } = useSetLocale();
	const [saved, setSaved] = useState(false);
	const [invalid, setInvalid] = useState(false);
	if (preferences.isPending) return <QueryPending />;
	if (preferences.isError || !preferences.data)
		return <QueryFailure error={preferences.error} retry={() => void preferences.refetch()} />;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		setInvalid(false);
		const current = preferences.data;
		if (!current) return;
		const data = new FormData(event.currentTarget);
		const interfaceLocale = String(data.get("interfaceLocale"));
		const contentLanguage = String(data.get("contentLanguage"));
		const selectedRatings = data.getAll("contentRating").filter(isContentRating);
		if (
			!selectedRatings.length ||
			!isStoredUiLocale(interfaceLocale) ||
			!isContentLanguage(contentLanguage)
		) {
			setInvalid(true);
			return;
		}
		try {
			await update.mutateAsync({
				body: {
					interfaceLocale,
					defaultLicense: String(data.get("defaultLicense") ?? "") || null,
					defaultRealmManageMode: data.get("defaultRealmManageMode") === "true",
					collectionConfig: current.collectionConfig,
					personalizedFeed: data.get("personalizedFeed") === "true",
					contentRatings: selectedRatings,
					preferredLanguages: [
						contentLanguage,
						...current.preferredLanguages.filter(
							(language) => language !== contentLanguage,
						),
					],
				},
			});
			setLocale(toUiLocale(interfaceLocale));
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame title={t.settings.preferences}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.settings.interfaceLanguage}</FieldLabel>
						<NativeSelect
							name="interfaceLocale"
							defaultValue={preferences.data.interfaceLocale}
						>
							<NativeSelectOption value="zh-hant">{t.locale.zh}</NativeSelectOption>
							<NativeSelectOption value="en">{t.locale.en}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.contentLanguage}</FieldLabel>
						<NativeSelect
							name="contentLanguage"
							defaultValue={preferences.data.preferredLanguages[0] ?? "zh"}
						>
							<NativeSelectOption value="zh">{t.locale.zh}</NativeSelectOption>
							<NativeSelectOption value="en">{t.locale.en}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.defaultLicense}</FieldLabel>
						<Input
							name="defaultLicense"
							defaultValue={preferences.data.defaultLicense ?? ""}
						/>
					</Field>
					<FieldSet>
						<FieldLegend variant="label">{t.ui.contentRating}</FieldLegend>
						<CheckboxGroup className="grid gap-2 sm:grid-cols-2">
							{ContentRatings.map((rating) => (
								<Field invalid={invalid} key={rating} orientation="horizontal">
									<Checkbox
										defaultChecked={preferences.data.contentRatings.includes(
											rating,
										)}
										name="contentRating"
										value={rating}
									/>
									<FieldLabel className="font-normal">
										{rating === "general"
											? t.settings.general
											: rating.toUpperCase()}
									</FieldLabel>
								</Field>
							))}
						</CheckboxGroup>
						{invalid && (
							<Alert variant="destructive">
								<AlertDescription>{t.errors.invalid}</AlertDescription>
							</Alert>
						)}
					</FieldSet>
					<Field>
						<FieldLabel>{t.feed.personalized}</FieldLabel>
						<NativeSelect
							name="personalizedFeed"
							defaultValue={String(preferences.data.personalizedFeed)}
						>
							<NativeSelectOption value="false">{t.settings.off}</NativeSelectOption>
							<NativeSelectOption value="true">{t.settings.on}</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.settings.realmManageMode}</FieldLabel>
						<NativeSelect
							name="defaultRealmManageMode"
							defaultValue={String(preferences.data.defaultRealmManageMode ?? false)}
						>
							<NativeSelectOption value="false">{t.settings.off}</NativeSelectOption>
							<NativeSelectOption value="true">{t.settings.on}</NativeSelectOption>
						</NativeSelect>
					</Field>
					{saved && <p className="text-success-foreground text-sm">{t.ui.saved}</p>}
					<Button type="submit" isLoading={update.isPending}>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
		</SettingsFrame>
	);
}

export function AccountSettings() {
	const { t } = useTranslation([
		"errors",
		"feed",
		"governance",
		"locale",
		"media",
		"settings",
		"ui",
	]);
	const router = useRouter();
	const queryClient = useQueryClient();
	return (
		<SettingsFrame title={t.settings.account}>
			<Card>
				<CardContent className="flex flex-col items-start gap-4">
					<p className="text-sm text-muted-foreground">{t.settings.accountDescription}</p>
					<Button
						variant="outline"
						onClick={async () => {
							await authClient.signOut();
							queryClient.clear();
							router.push("/");
							router.refresh();
						}}
					>
						{t.ui.logout}
					</Button>
				</CardContent>
			</Card>
		</SettingsFrame>
	);
}
