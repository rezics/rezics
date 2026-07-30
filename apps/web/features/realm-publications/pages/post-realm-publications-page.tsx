"use client";

import { PostManagementSectionHeader } from "@/features/posts/components/post-management-section-header";
import { usePostManagement } from "@/features/posts/components/post-management-workspace";
import { useTranslation } from "@/i18n/client";
import { RealmPublicationManager } from "../components/realm-publication-manager";

export function PostRealmPublicationsPage() {
	const { t } = useTranslation(["units"]);
	const { resource } = usePostManagement();
	return (
		<section className="grid gap-8">
			<PostManagementSectionHeader
				description={t.units.realmPublications.description}
				title={t.units.realmPublications.title}
			/>
			<RealmPublicationManager unitId={resource.item.id} />
		</section>
	);
}
