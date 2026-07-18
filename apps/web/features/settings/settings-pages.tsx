"use client";

import {
	getApiUsersByIdQueryKey,
	getApiUsersMePreferencesQueryKey,
	getApiUsersMeQueryKey,
	useDeleteApiImageAssetsById,
	useGetApiUsersMe,
	useGetApiUsersMePreferences,
	usePatchApiUsersMe,
	usePostApiImageAssets,
	usePostApiImageAssetsByIdComplete,
	usePutApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Checkbox, CheckboxGroup } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@rezics/ui";
import { FileUpload, FileUploadTrigger } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
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
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const profile = useGetApiUsersMe();
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
	const requestUpload = usePostApiImageAssets();
	const completeUpload = usePostApiImageAssetsByIdComplete();
	const deleteUpload = useDeleteApiImageAssetsById();
	const [saved, setSaved] = useState(false);
	const [avatarFiles, setAvatarFiles] = useState<File[]>([]);
	const [uploadError, setUploadError] = useState(false);
	if (profile.isPending) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	const current = profile.data;
	async function uploadAvatar(file: File) {
		let assetId: string | undefined;
		setUploadError(false);
		try {
			const asset = await requestUpload.mutateAsync({
				body: { contentType: file.type, size: file.size, access: "public" },
			});
			assetId = asset.id;
			const response = await fetch(asset.upload.url, {
				method: "PUT",
				headers: asset.upload.headers,
				body: file,
			});
			if (!response.ok) throw new Error("Upload failed");
			await completeUpload.mutateAsync({ path: { id: asset.id } });
			await update.mutateAsync({
				body: { updatedAt: current.updatedAt, avatarAssetId: asset.id },
			});
		} catch {
			if (assetId)
				await deleteUpload.mutateAsync({ path: { id: assetId } }).catch(() => undefined);
			setUploadError(true);
		} finally {
			setAvatarFiles([]);
		}
	}
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		const data = new FormData(event.currentTarget);
		const name = String(data.get("name") ?? "").trim();
		const slug = String(data.get("slug") ?? "").trim();
		try {
			await update.mutateAsync({
				body: {
					updatedAt: current.updatedAt,
					...(name ? { name } : {}),
					...(slug ? { slug } : {}),
					summary: String(data.get("summary") ?? "").trim(),
				},
			});
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}
	return (
		<SettingsFrame title={t.settings.profile}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.ui.avatar}</FieldLabel>
						<FileUpload
							accept="image/jpeg,image/png,image/webp,image/gif"
							acceptedFiles={avatarFiles}
							disabled={requestUpload.isPending || completeUpload.isPending}
							maxFiles={1}
							onFileAccept={({ files }) => {
								const file = files[0];
								if (file) void uploadAvatar(file);
							}}
							onFileChange={({ acceptedFiles }) => setAvatarFiles(acceptedFiles)}
							onFileReject={() => setUploadError(true)}
						>
							<div className="flex flex-wrap items-center gap-4">
								<Avatar className="size-16">
									{current.avatar && <AvatarImage alt="" src={current.avatar} />}
									<AvatarFallback>
										{(current.name ?? current.slug ?? t.ui.avatar)
											.slice(0, 1)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<FileUploadTrigger asChild>
									<Button type="button" variant="outline">
										{t.cover.choose}
									</Button>
								</FileUploadTrigger>
							</div>
						</FileUpload>
						{uploadError && (
							<p className="text-destructive text-sm">{t.ui.retryLater}</p>
						)}
					</Field>
					<Field>
						<FieldLabel>{t.ui.displayName}</FieldLabel>
						<Input name="name" defaultValue={current.name ?? ""} />
					</Field>
					<Field>
						<FieldLabel>{t.ui.slug}</FieldLabel>
						<Input name="slug" defaultValue={current.slug ?? ""} />
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
		</SettingsFrame>
	);
}

export function PreferenceSettings() {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const preferences = useGetApiUsersMePreferences();
	const update = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMePreferencesQueryKey() }),
		},
	});
	const setLocale = useSetLocale();
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
		const interfaceLanguage = String(data.get("interfaceLanguage"));
		const selectedRatings = data.getAll("contentRating").filter(isContentRating);
		if (!selectedRatings.length) {
			setInvalid(true);
			return;
		}
		try {
			await update.mutateAsync({
				body: {
					defaultLicense: String(data.get("defaultLicense") ?? "") || null,
					defaultRealmManageMode: data.get("defaultRealmManageMode") === "true",
					collectionConfig: current.collectionConfig,
					personalizedFeed: data.get("personalizedFeed") === "true",
					contentRatings: selectedRatings,
					preferredLanguages: [
						interfaceLanguage,
						...current.preferredLanguages.filter(
							(language) => language !== interfaceLanguage,
						),
					],
				},
			});
			setLocale(interfaceLanguage);
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
						<FieldLabel>{t.ui.language}</FieldLabel>
						<NativeSelect
							name="interfaceLanguage"
							defaultValue={preferences.data.preferredLanguages[0] ?? "zh-CN"}
						>
							<NativeSelectOption value="zh-CN">{t.locale.zh}</NativeSelectOption>
							<NativeSelectOption value="en-US">{t.locale.en}</NativeSelectOption>
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
	const { t } = useTranslation({ suspense: true });
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
