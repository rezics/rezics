"use client";

import {
	useReadCatalogResource,
	useListTextVersionContentNodes,
	useListProgramContentNodes,
} from "@rezics/openapi-tanstack-query";
import { ManagementWorkspaceSectionHeader, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { ContentStructureRevisionHistory } from "../components/content-structure-revision-history";

type ContentStructureHistorySource =
	| { readonly kind: "uninitialized" }
	| {
			readonly kind: "initialized";
			readonly latestRevisionId: string;
			readonly structureId: string;
	  };

export function ContentStructureHistoryPage({
	owner,
	unitId,
}: {
	owner: "publishing" | "program";
	unitId: string;
}) {
	const resource = useReadCatalogResource({ path: { owner, id: unitId } });
	const localizationLanguages = useLocalizationLanguages();
	const bookQuery = useListTextVersionContentNodes(
		{
			path: { unitId: unitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: owner === "publishing" } },
	);
	const mediaQuery = useListProgramContentNodes(
		{
			path: { unitId: unitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: owner === "program" } },
	);

	if (resource.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;

	if (owner === "publishing") {
		if (bookQuery.isPending) return <QueryPending />;
		if (bookQuery.isError)
			return <QueryFailure error={bookQuery.error} retry={() => void bookQuery.refetch()} />;
		if (!bookQuery.data.structureId || !bookQuery.data.latestRevisionId)
			return (
				<ContentStructureHistoryView
					canRestore={resource.data.canEdit}
					source={{ kind: "uninitialized" }}
					owner={owner}
					unitId={unitId}
				/>
			);
		return (
			<ContentStructureHistoryView
				canRestore={resource.data.canEdit}
				source={{
					kind: "initialized",
					latestRevisionId: bookQuery.data.latestRevisionId,
					structureId: bookQuery.data.structureId,
				}}
				owner={owner}
				unitId={unitId}
			/>
		);
	}
	if (mediaQuery.isPending) return <QueryPending />;
	if (mediaQuery.isError)
		return <QueryFailure error={mediaQuery.error} retry={() => void mediaQuery.refetch()} />;
	return (
		<ContentStructureHistoryView
			canRestore={resource.data.canEdit}
			source={
				mediaQuery.data.structureId !== null && mediaQuery.data.latestRevisionId !== null
					? {
							kind: "initialized",
							latestRevisionId: mediaQuery.data.latestRevisionId,
							structureId: mediaQuery.data.structureId,
						}
					: { kind: "uninitialized" }
			}
			owner={owner}
			unitId={unitId}
		/>
	);
}

function ContentStructureHistoryView({
	canRestore,
	source,
	owner,
	unitId,
}: {
	readonly canRestore: boolean;
	readonly source: ContentStructureHistorySource;
	readonly owner: "publishing" | "program";
	readonly unitId: string;
}) {
	const { t } = useTranslation(["history", "units"]);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={`/catalog/${owner}/${unitId}/contents`}
				backLabel={t.units.chapter.backToStructure}
				description={t.history.description}
				link={Link}
				title={t.history.title}
			/>
			{source.kind === "initialized" ? (
				<ContentStructureRevisionHistory
					canRestore={canRestore}
					latestRevisionId={source.latestRevisionId}
					structureId={source.structureId}
					unitId={unitId}
				/>
			) : (
				<p className="text-sm text-muted-foreground">{t.history.noRevisions}</p>
			)}
		</section>
	);
}
