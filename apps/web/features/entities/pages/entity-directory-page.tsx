"use client";
import { Button, PageHeading } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { SearchFeatureFeed } from "@/features/content-feed/components/search-feature-feed";
import { studioSectionCreateHref } from "@/features/create/model/studio-section";
import { useTranslation } from "@/i18n/client";
export function EntitiesPage() {
	const { t } = useTranslation(["entities", "actions"]);
	return (
		<main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
			<PageHeading
				title={t.entities.entities}
				action={
					<Button asChild>
						<AppLink href={studioSectionCreateHref("entity")}>{t.actions.create}</AppLink>
					</Button>
				}
			/>
			<SearchFeatureFeed
				initialRequest={{
					contexts: [],
					state: {},
					injections: [
						{
							source: "link",
							removable: false,
							value: {
								controlKey: "unit-owner",
								filter: { field: "unit-owner", operator: "equals", value: "entity" },
							},
						},
					],
				}}
			/>
		</main>
	);
}
