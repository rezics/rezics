"use client";
import { useGetApiTags } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending, UnitList } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { StudioTagCreateHref } from "@/features/create/model/studio-section";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
export function TagsPage() {
	const { t } = useTranslation(["entities", "actions"]),
		localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTags({ query: { limit: 50, localizationLanguages } });
	return (
		<main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
			<PageHeading
				title={t.entities.tags}
				action={
					<Button asChild>
						<AppLink href={StudioTagCreateHref}>{t.actions.create}</AppLink>
					</Button>
				}
			/>
			{query.isPending ? (
				<QueryPending />
			) : query.isError ? (
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			) : (
				<UnitList
					items={query.data.items}
					href={(item) => `/tags/${item.id}`}
					pending={false}
					error={false}
				/>
			)}
		</main>
	);
}
