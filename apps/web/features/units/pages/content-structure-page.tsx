"use client";

import {
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	useGetApiUnitsMediaByUnitIdContentStructureNodes,
} from "@rezics/openapi-tanstack-query";
import { Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";

import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { BookContentStructureEditor } from "../components/book-content-structure-editor";
import { MediaContentStructureEditor } from "../components/media-content-structure-editor";
import { UnitSectionHeader } from "../components/unit-section-header";
import type { UnitType } from "../unit-types";

export function ContentStructurePage({
	type,
	unitId,
}: {
	type: Exclude<UnitType, "series">;
	unitId: string;
}) {
	return type === "book" ? (
		<BookContentStructurePage bookId={unitId} />
	) : type === "media" ? (
		<MediaContentStructurePage mediaId={unitId} />
	) : (
		<DevelopmentPreviewBoundary>
			<UnreleasedContentStructurePage />
		</DevelopmentPreviewBoundary>
	);
}

function MediaContentStructurePage({ mediaId }: { mediaId: string }) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsMediaByUnitIdContentStructureNodes(
		{
			path: { unitId: mediaId },
			query: { localizationLanguages },
		},
		{
			query: {
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
			},
		},
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<MediaContentStructureEditor
			initial={query.data}
			key={query.data.state === "initialized" ? query.data.latestRevisionId : "uninitialized"}
			mediaId={mediaId}
		/>
	);
}

function BookContentStructurePage({ bookId }: { bookId: string }) {
	const { t } = useTranslation(["ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsBookByUnitIdContentStructureNodes(
		{
			path: { unitId: bookId },
			query: { localizationLanguages },
		},
		{
			query: {
				refetchOnReconnect: false,
				refetchOnWindowFocus: false,
			},
		},
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data?.structureId || !query.data.latestRevisionId)
		return (
			<div className="grid min-h-64 w-full place-items-center">
				<p className="text-sm text-destructive">{t.ui.retryLater}</p>
			</div>
		);
	return (
		<BookContentStructureEditor
			bookId={bookId}
			initial={{
				...query.data,
				structureId: query.data.structureId,
				latestRevisionId: query.data.latestRevisionId,
			}}
			key={query.data.latestRevisionId}
		/>
	);
}

/**
 * Placeholder for a future type-owned Content Structure editor.
 *
 * @alpha
 * @remarks
 * Software remains visibly unavailable in the product. Its generic API surface
 * is independently protected by the development preview capability.
 */
export function UnreleasedContentStructurePage() {
	const { t } = useTranslation(["units"]);
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.contentStructure.description}
				title={t.units.workspace.sections.contentStructure.label}
			/>
			<Card appearance="outlined">
				<CardContent className="grid min-h-48 place-items-center gap-2 p-8 text-center">
					<h2 className="font-heading text-lg font-semibold">{t.units.content.development}</h2>
					<p className="max-w-xl text-sm leading-6 text-muted-foreground">
						{t.units.content.developmentDescription}
					</p>
				</CardContent>
			</Card>
		</section>
	);
}
