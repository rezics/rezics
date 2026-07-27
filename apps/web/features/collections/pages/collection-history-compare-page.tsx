"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import Link from "next/link";

import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { collectionManagementSectionHref } from "../routing/collection-management-routes";

export function CollectionHistoryComparePage({
	from,
	to,
}: {
	readonly from: string | null;
	readonly to: string | null;
}) {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["errors", "history"]);
	const historyHref = collectionManagementSectionHref(collection.id, "history");
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={historyHref}
				backLabel={t.history.title}
				link={Link}
				title={t.history.compareTitle}
			/>
			{from && to ? (
				<UnitRevisionCompare from={from} to={to} unitId={collection.id} />
			) : (
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			)}
		</section>
	);
}
