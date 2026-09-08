"use client";

import {
	getApiUnitsByIdByUnitIdSubjectAssociations,
	getApiUnitsByIdByUnitIdSubjectAssociationsQueryKey,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { UnitSubjectGroups } from "../components/unit-subject-groups";
import type { CatalogReference } from "@rezics/reference";

const AssociationPageSize = 8;

export function UnitAssociationsPage({ reference }: { reference: CatalogReference }) {
	const localizationLanguages = useLocalizationLanguages();
	const { t } = useTranslation(["actions", "engagement", "feed", "state", "ui", "units"]);
	const path = { unitId: reference.id };
	const baseQuery = { limit: AssociationPageSize, localizationLanguages };
	const associations = useInfiniteQuery({
		queryKey: getApiUnitsByIdByUnitIdSubjectAssociationsQueryKey({ path, query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUnitsByIdByUnitIdSubjectAssociations({
				path,
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const items = associations.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<UnitDetailSectionFrame title={t.units.detail.subjectAssociations}>
			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.units.detail.subjectAssociations}</h2>
				</div>
				{associations.isPending ? <QueryPending /> : null}
				{associations.isError ? (
					<QueryFailure error={associations.error} retry={() => void associations.refetch()} />
				) : null}
				{!associations.isPending && !associations.isError ? (
					items.length ? (
						<UnitSubjectGroups associations={items} />
					) : (
						<p className="text-sm text-muted-foreground">{t.state.empty}</p>
					)
				) : null}
				{associations.hasNextPage ? (
					<Button
						className="w-fit"
						isLoading={associations.isFetchingNextPage}
						onClick={() => void associations.fetchNextPage()}
						variant="outline"
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</section>
		</UnitDetailSectionFrame>
	);
}
