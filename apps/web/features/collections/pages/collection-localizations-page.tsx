"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";
import {
	type GetApiCollectionsByCollectionIdStatus200,
	usePatchApiCollectionsByCollectionId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Field,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { CollectionLocalizationFields } from "../components/collection-localization-fields";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { invalidateCollections } from "../data/collection-cache";
import { collectionManagementHref } from "../routing/collection-management-routes";

export function CollectionLocalizationsPage() {
	const { collection } = useCollectionManagement();
	const { locale, t } = useTranslation(["collections", "errors", "locale"]);
	const [language, setLanguage] = useState<ContentLanguage>(toContentLanguage(locale.target));
	if (!collection.capabilities.canManageLocalizations)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const localization = collection.localizations.find((entry) => entry.language === language);
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
				description={t.collections.workspace.sections.localizations.description}
				link={Link}
				title={t.collections.workspace.sections.localizations.label}
			/>
			<Field className="max-w-xs">
				<FieldLabel>{t.collections.form.language}</FieldLabel>
				<NativeSelect
					onChange={(event) => {
						if (isContentLanguage(event.currentTarget.value))
							setLanguage(event.currentTarget.value);
					}}
					value={language}
				>
					{ContentLanguageValues.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.locale[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<CollectionLocalizationEditor
				collection={collection}
				initial={localization}
				key={`${collection.latestRevisionId}:${language}`}
				language={language}
			/>
		</section>
	);
}

function CollectionLocalizationEditor({
	collection,
	initial,
	language,
}: {
	readonly collection: ReturnType<typeof useCollectionManagement>["collection"];
	readonly initial: GetApiCollectionsByCollectionIdStatus200["localizations"][number] | undefined;
	readonly language: ContentLanguage;
}) {
	const { t } = useTranslation(["collections", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiCollectionsByCollectionId();
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(initial?.cover ?? null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const title = String(form.get("title") ?? "").trim();
		if (!title) return;
		try {
			await update.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					localization: {
						language,
						title,
						summary: String(form.get("summary") ?? "").trim(),
						coverAssetId: cover?.id ?? null,
					},
				},
			});
			await invalidateCollections(queryClient, collection.id);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form className="grid max-w-xl gap-6" onSubmit={(event) => void submit(event)}>
			<CollectionLocalizationFields
				cover={cover}
				initial={initial}
				onCoverChange={setCover}
			/>
			<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			<Button className="w-fit" isLoading={update.isPending} type="submit" variant="solid">
				{t.collections.form.save}
			</Button>
		</form>
	);
}
