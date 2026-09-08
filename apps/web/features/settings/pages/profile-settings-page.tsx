"use client";

import { ContentLanguageValues, isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import {
	useGetApiAccountMe,
	usePatchApiAccountMe,
	type GetApiAccountMeStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
	AvatarField,
	avatarPresentationToInput,
	type AvatarFieldValue,
} from "@/features/media/components/avatar-field";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export function ProfileSettings() {
	const { t } = useTranslation(["locale", "settings", "units"]);
	const preferred = useLocalizationLanguages();
	const [language, setLanguage] = useState<ContentLanguage>(preferred[0] ?? "en");
	const account = useGetApiAccountMe({ query: { localizationLanguages: [language] } });
	return (
		<section className="grid max-w-2xl gap-6">
			<PageHeading title={t.settings.profile} />
			<NativeSelect
				aria-label={t.units.contentLanguages.controlLabel}
				value={language}
				onChange={(event) => {
					if (isContentLanguage(event.currentTarget.value)) setLanguage(event.currentTarget.value);
				}}
			>
				{ContentLanguageValues.map((value) => (
					<NativeSelectOption key={value} value={value}>
						{t.locale.contentLanguages[value]}
					</NativeSelectOption>
				))}
			</NativeSelect>
			{account.isPending ? (
				<QueryPending />
			) : account.isError ? (
				<QueryFailure error={account.error} retry={() => void account.refetch()} />
			) : (
				<PresentationForm
					key={language}
					entity={account.data.entity}
					language={language}
				/>
			)}
		</section>
	);
}

function PresentationForm({
	entity,
	language,
}: {
	entity: GetApiAccountMeStatus200["entity"];
	language: ContentLanguage;
}) {
	const { t } = useTranslation(["settings", "media", "ui"]);
	const queryClient = useQueryClient();
	const current = entity.language === language;
	const [expectedRevision, setExpectedRevision] = useState(current ? entity.revision : 0);
	const [name, setName] = useState(current ? (entity.name ?? "") : "");
	const [summary, setSummary] = useState(current ? (entity.summary ?? "") : "");
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(current ? entity.avatar : null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(
		current ? entity.banner : null,
	);
	const update = usePatchApiAccountMe();
	async function submit(event: FormEvent) {
		event.preventDefault();
		try {
			const updated = await update.mutateAsync({
				body: {
					language,
					expectedRevision,
					name: name.trim(),
					summary: summary.trim(),
					avatar: avatarPresentationToInput(avatar),
					bannerAssetId: banner?.id ?? null,
				},
			});
			setExpectedRevision(updated.revision);
			await queryClient.invalidateQueries();
		} catch {
			/* The mutation error remains visible with the unchanged draft. */
		}
	}
	return (
		<form onSubmit={(event) => void submit(event)}>
			<FieldGroup>
				<Field>
					<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
					<AvatarField value={avatar} onChange={setAvatar} />
				</Field>
				<Field>
					<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
					<LocalizationImageUploadField role="banner" value={banner} onChange={setBanner} />
				</Field>
				<Field>
					<FieldLabel htmlFor="entity-name">{t.ui.displayName}</FieldLabel>
					<Input
						id="entity-name"
						required
						maxLength={120}
						value={name}
						onChange={(event) => setName(event.currentTarget.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="entity-summary">{t.ui.introduction}</FieldLabel>
					<Textarea
						id="entity-summary"
						maxLength={500}
						value={summary}
						onChange={(event) => setSummary(event.currentTarget.value)}
					/>
				</Field>
				<RequestFailure error={update.error} />
				<Button type="submit" variant="solid" disabled={!name.trim()} isLoading={update.isPending}>
					{t.ui.save}
				</Button>
			</FieldGroup>
		</form>
	);
}
