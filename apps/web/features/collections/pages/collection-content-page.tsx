"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	type GetApiCollectionsByCollectionIdStatus200,
	usePatchApiCollectionsByCollectionId,
} from "@rezics/openapi-tanstack-query";
import { Button, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { type FormEvent } from "react";

import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";
import { LocalizationMediaFallbackNotice } from "@/features/media/components/localization-media-fallback-notice";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftImageAsset,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { CollectionLocalizationFields } from "../components/collection-localization-fields";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { invalidateCollections } from "../data/collection-cache";
import { collectionManagementHref } from "../routing/collection-management-routes";

type CollectionLocalizationDraft = {
	title: string;
	summary: string;
	cover: LocalizationImageAssetValue | null;
};
const CollectionLocalizationDraftCodec: LocalizedDraftCodec<CollectionLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const cover = decodeDraftImageAsset(value.cover);
		return title === undefined || summary === undefined || cover === undefined
			? undefined
			: { title, summary, cover };
	},
};

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
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
				description={t.collections.workspace.sections.content.description}
				link={Link}
				title={t.collections.workspace.sections.content.label}
			/>
			<ContentLanguageControl />
			<LocalizationMediaFallbackNotice />
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
	const { languagesChanged } = useContentLanguageEditor();
	const update = usePatchApiCollectionsByCollectionId();
	const draft = useLocalizedDraft<CollectionLocalizationDraft>({
		scope: "collection-localization",
		baseVersion: collection.latestRevisionId,
		codec: CollectionLocalizationDraftCodec,
		createInitialValue: () => ({
			title: initial?.title ?? "",
			summary: initial?.summary ?? "",
			cover: initial?.cover ?? null,
		}),
	});
	const { value } = draft;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = value.title.trim();
		if (!title) return;
		try {
			await update.mutateAsync({
				path: { collectionId: collection.id },
				body: {
					baseRevisionId: collection.latestRevisionId,
					localization: {
						language,
						title,
						summary: value.summary.trim(),
						coverAssetId: value.cover?.id ?? null,
					},
				},
			});
			draft.commit();
			await invalidateCollections(queryClient, collection.id);
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
			<form className="grid max-w-xl gap-6" onSubmit={(event) => void submit(event)}>
				<CollectionLocalizationFields
					cover={value.cover}
					onCoverChange={(cover) => draft.setValue((current) => ({ ...current, cover }))}
					onValueChange={(fields) => draft.setValue((current) => ({ ...current, ...fields }))}
					value={value}
				/>
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				<Button className="w-fit" isLoading={update.isPending} type="submit" variant="solid">
					{t.collections.form.save}
				</Button>
			</form>
		</LocalizedDraftGate>
	);
}
