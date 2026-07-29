"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { UnitAccessManager } from "@/features/governance/components/unit-access-manager";
import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { collectionManagementHref } from "../routing/collection-management-routes";

export function CollectionAccessPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "errors"]);
	if (!collection.capabilities.canManageAccess)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToContent}
				description={t.collections.workspace.sections.access.description}
				link={Link}
				title={t.collections.workspace.sections.access.label}
			/>
			<UnitAccessManager unitId={collection.id} />
		</section>
	);
}
