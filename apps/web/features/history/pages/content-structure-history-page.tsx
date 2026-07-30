"use client";

import {
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	useGetApiUnitsMediaByUnitIdContentStructureNodes,
} from "@rezics/openapi-tanstack-query";
import { ManagementWorkspaceSectionHeader, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useUnitManagement } from "@/features/units/components/unit-management-workspace";
import { unitManagementSectionHref } from "@/features/units/routing/unit-management-routes";
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

export function ContentStructureHistoryPage() {
	const { t } = useTranslation(["errors"]);
	const { type, unit } = useUnitManagement();
	const localizationLanguages = useLocalizationLanguages();
	const bookQuery = useGetApiUnitsBookByUnitIdContentStructureNodes(
		{
			path: { unitId: unit.id },
			query: { localizationLanguages },
		},
		{ query: { enabled: type === "book" } },
	);
	const mediaQuery = useGetApiUnitsMediaByUnitIdContentStructureNodes(
		{
			path: { unitId: unit.id },
			query: { localizationLanguages },
		},
		{ query: { enabled: type === "media" } },
	);
	if ((type !== "book" && type !== "media") || !unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	if (type === "book") {
		if (bookQuery.isPending) return <QueryPending />;
		if (bookQuery.isError)
			return <QueryFailure error={bookQuery.error} retry={() => void bookQuery.refetch()} />;
		if (!bookQuery.data.structureId || !bookQuery.data.latestRevisionId)
			return <p className="text-sm text-destructive">{t.errors.invalid}</p>;
		return (
			<ContentStructureHistoryView
				canRestore={unit.capabilities.canEdit}
				source={{
					kind: "initialized",
					latestRevisionId: bookQuery.data.latestRevisionId,
					structureId: bookQuery.data.structureId,
				}}
				type={type}
				unitId={unit.id}
			/>
		);
	}
	if (mediaQuery.isPending) return <QueryPending />;
	if (mediaQuery.isError)
		return <QueryFailure error={mediaQuery.error} retry={() => void mediaQuery.refetch()} />;
	return (
		<ContentStructureHistoryView
			canRestore={unit.capabilities.canEdit}
			source={
				mediaQuery.data.state === "initialized"
					? {
							kind: "initialized",
							latestRevisionId: mediaQuery.data.latestRevisionId,
							structureId: mediaQuery.data.structureId,
						}
					: { kind: "uninitialized" }
			}
			type={type}
			unitId={unit.id}
		/>
	);
}

function ContentStructureHistoryView({
	canRestore,
	source,
	type,
	unitId,
}: {
	readonly canRestore: boolean;
	readonly source: ContentStructureHistorySource;
	readonly type: "book" | "media";
	readonly unitId: string;
}) {
	const { t } = useTranslation(["history", "units"]);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={unitManagementSectionHref(type, unitId, "content-structure")}
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
