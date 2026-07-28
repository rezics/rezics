"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { invalidateCollections } from "../data/collection-cache";
import {
	collectionManagementHref,
	collectionManagementSectionHref,
} from "../routing/collection-management-routes";

export function CollectionHistoryPage() {
	const { collection } = useCollectionManagement();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["collections", "errors"]);
	if (!collection.capabilities.canViewHistory)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const historyHref = collectionManagementSectionHref(collection.id, "history");
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToContent}
				description={t.collections.workspace.sections.history.description}
				link={Link}
				title={t.collections.workspace.sections.history.label}
			/>
			<UnitRevisionHistory
				compareHref={(from, to) =>
					`${historyHref}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
				}
				onChanged={() => invalidateCollections(queryClient, collection.id)}
				unitId={collection.id}
			/>
		</section>
	);
}
