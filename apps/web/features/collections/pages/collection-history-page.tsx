"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { CollectionStructureRevisionHistory } from "@/features/history/components/collection-structure-revision-history";
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
				backLabel={t.collections.workspace.backToOverview}
				description={t.collections.workspace.sections.history.description}
				link={Link}
				title={t.collections.workspace.sections.history.label}
			/>
			<section className="grid gap-3">
				<h2 className="text-lg font-semibold">
					{t.collections.workspace.sections.metadata.label}
				</h2>
				<UnitRevisionHistory
					compareHref={(from, to) =>
						`${historyHref}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
					}
					onChanged={() => invalidateCollections(queryClient, collection.id)}
					unitId={collection.id}
				/>
			</section>
			<section className="grid gap-3">
				<h2 className="text-lg font-semibold">
					{t.collections.workspace.sections.items.label}
				</h2>
				<CollectionStructureRevisionHistory
					canRestore={collection.capabilities.canRestoreHistory}
					collectionId={collection.id}
					compareHref={(from, to) =>
						`${historyHref}/compare?stream=items&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
					}
					latestRevisionId={collection.latestItemsRevisionId}
				/>
			</section>
		</section>
	);
}
