"use client";

import { useGetApiUnitsBookByUnitIdContentStructureNodes } from "@rezics/openapi-tanstack-query";
import { ManagementWorkspaceSectionHeader, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import { useUnitManagement } from "@/features/units/components/unit-management-workspace";
import { unitManagementSectionHref } from "@/features/units/routing/unit-management-routes";
import { useTranslation } from "@/i18n/client";
import { ContentStructureRevisionHistory } from "../components/content-structure-revision-history";

export function ContentStructureHistoryPage() {
	const { t } = useTranslation(["errors", "history", "units"]);
	const { type, unit } = useUnitManagement();
	const query = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: unit.id },
	});
	if (type !== "book" || !unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.structureId || !query.data.latestRevisionId)
		return <p className="text-sm text-destructive">{t.errors.invalid}</p>;
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={unitManagementSectionHref("book", unit.id, "content-structure")}
				backLabel={t.units.chapter.backToStructure}
				description={t.history.description}
				link={Link}
				title={t.history.title}
			/>
			<ContentStructureRevisionHistory
				canRestore={unit.capabilities.canEdit}
				latestRevisionId={query.data.latestRevisionId}
				structureId={query.data.structureId}
				unitId={unit.id}
			/>
		</section>
	);
}
