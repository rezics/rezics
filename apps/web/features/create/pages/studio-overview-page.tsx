"use client";

import { useGetApiRealmsByRealmId } from "@rezics/openapi-tanstack-query";
import { ManagementWorkspaceOverview, type ManagementWorkspaceSection } from "@rezics/ui";
import { TagsIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useSearchParams } from "next/navigation";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useStudioWorkspaceSections } from "../components/studio-workspace";
import { studioSectionCreateHref } from "../model/studio-section";

export function StudioOverviewPage() {
	const { t } = useTranslation(["create"]);
	const sections = useStudioWorkspaceSections();
	const searchParams = useSearchParams();
	const realmId = searchParams.get("realmId") ?? "";
	const localizationLanguages = useLocalizationLanguages();
	const realm = useGetApiRealmsByRealmId(
		{ path: { realmId }, query: { localizationLanguages } },
		{ query: { enabled: Boolean(realmId) } },
	);
	const creationSections: ManagementWorkspaceSection<string>[] = sections.flatMap((section) => {
		const createHref = studioSectionCreateHref(section.id);
		if (!createHref) return [];
		const href =
			realmId && (section.id === "post" || section.id === "wiki")
				? `${createHref}?realmId=${encodeURIComponent(realmId)}`
				: createHref;
		return [{ ...section, href }];
	});
	if (realm.data?.capabilities.canManageTags && realm.data.capabilities.canCreateUnits)
		creationSections.splice(1, 0, {
			id: "realm-tag-context",
			href: `/tag-contexts/new?realmId=${encodeURIComponent(realm.data.id)}`,
			label: t.create.realmTagContext.label,
			description: t.create.realmTagContext.description,
			icon: TagsIcon,
		});

	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.create.workspace.overview}
			link={Link}
			sections={creationSections}
		/>
	);
}
