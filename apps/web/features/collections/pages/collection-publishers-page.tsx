"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	ManagementWorkspaceSectionHeader,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { UnitAttributionProposalManager } from "@/features/governance/unit-workflows";
import { AttributionLinks } from "@/features/posts/attribution-list";
import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";
import { collectionManagementHref } from "../routing/collection-management-routes";

export function CollectionPublishersPage() {
	const { collection } = useCollectionManagement();
	const { t } = useTranslation(["collections", "errors"]);
	if (!collection.capabilities.canManagePublishers)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const publishers = collection.attributions.filter(
		(attribution) => attribution.role === "publisher",
	);
	return (
		<section className="grid gap-6">
			<ManagementWorkspaceSectionHeader
				backHref={collectionManagementHref(collection.id)}
				backLabel={t.collections.workspace.backToOverview}
				description={t.collections.workspace.sections.publishers.description}
				link={Link}
				title={t.collections.workspace.sections.publishers.label}
			/>
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{t.collections.publishers.current}</CardTitle>
					<CardDescription>{t.collections.publishers.currentDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					<AttributionLinks
						attributions={publishers}
						emptyLabel={t.collections.publishers.unknown}
						publisherLabel={t.collections.publishers.label}
					/>
				</CardContent>
			</Card>
			<UnitAttributionProposalManager creditRoles={["publisher"]} unitId={collection.id} />
		</section>
	);
}
