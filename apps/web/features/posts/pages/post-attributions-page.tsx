"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rezics/ui";

import { UnitAttributionProposalManager } from "@/features/governance/unit-workflows";
import { useTranslation } from "@/i18n/client";
import { AttributionLinks } from "../attribution-list";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { usePostManagement } from "../components/post-management-workspace";

export function PostAttributionsPage() {
	const { t } = useTranslation(["errors", "posts"]);
	const { resource } = usePostManagement();
	const { item } = resource;
	if (!item.capabilities.canManageAttributions)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<PostManagementSectionHeader
				description={t.posts.workspace.sections.attributions.description}
				title={t.posts.workspace.sections.attributions.label}
			/>
			<div className="grid gap-6">
				<Card appearance="outlined">
					<CardHeader>
						<CardTitle>{t.posts.workspace.currentAttributions}</CardTitle>
						<CardDescription>
							{t.posts.workspace.currentAttributionsDescription}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<AttributionLinks
							attributions={item.attributions}
							emptyLabel={t.posts.unknownAttribution}
						/>
					</CardContent>
				</Card>
				<UnitAttributionProposalManager unitId={item.id} />
			</div>
		</section>
	);
}
