"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	type GetApiCollectionsByCollectionIdStatus200,
	usePatchApiCollectionsByCollectionId,
} from "@rezics/openapi-tanstack-query";
import { Button, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type FormEvent } from "react";

import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { CollectionLocalizationFields } from "../components/collection-localization-fields";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { invalidateCollections } from "../data/collection-cache";
import { collectionHref } from "../routing/collection-management-routes";

export function CollectionContentPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "errors"]);
	const { selectedLanguage: language } = useContentLanguageEditor();
	if (!collection.capabilities.canManageLocalizations)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const localization = collection.localizations.find((entry) => entry.language === language);
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionHref(collection.id)}
				backLabel={t.collections.workspace.backToCollection}
				description={t.collections.workspace.sections.content.description}
				link={Link}
				title={t.collections.workspace.sections.content.label}
			/>
			<ContentLanguageControl />
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
	const { setDirty, languagesChanged } = useContentLanguageEditor();
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
			setDirty(false);
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form
			className="grid max-w-xl gap-6"
			onChange={() => setDirty(true)}
			onSubmit={(event) => void submit(event)}
		>
			<CollectionLocalizationFields
				cover={cover}
				initial={initial}
				onCoverChange={(value) => {
					setCover(value);
					setDirty(true);
				}}
			/>
			<RequestFailure error={update.error} fallback={t.ui.retryLater} />
			<Button className="w-fit" isLoading={update.isPending} type="submit" variant="solid">
				{t.collections.form.save}
			</Button>
		</form>
	);
}
