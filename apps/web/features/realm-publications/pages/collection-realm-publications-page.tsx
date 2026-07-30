"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useCollectionManagement } from "@/features/collections/components/collection-management-workspace";
import { collectionManagementHref } from "@/features/collections/routing/collection-management-routes";
import { useTranslation } from "@/i18n/client";
import { RealmPublicationManager } from "../components/realm-publication-manager";

export function CollectionRealmPublicationsPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "units"]);
	return (
		<section className="grid gap-8">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
				description={t.units.realmPublications.description}
				link={Link}
				title={t.units.realmPublications.title}
			/>
			<RealmPublicationManager unitId={collection.id} />
		</section>
	);
}
