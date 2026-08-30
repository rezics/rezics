"use client";

import {
	getApiUnitsByTypeByUnitIdSubjectAssociations,
	getApiUnitsByTypeByUnitIdSubjectAssociationsQueryKey,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { UnitSeriesMemberships } from "../components/unit-series-memberships";
import { UnitSubjectGroups } from "../components/unit-subject-groups";
import { UnitVariantList } from "../components/unit-variant-list";
import { useUnitDetail } from "../components/unit-detail-workspace";
import { unitDetailPageCopy } from "../model/unit-detail-copy";

const AssociationPageSize = 8;

export function UnitAssociationsPage() {
	const detail = useUnitDetail();
	const localizationLanguages = useLocalizationLanguages();
	const { t } = useTranslation(["actions", "engagement", "feed", "state", "ui", "units"]);
	const labels = unitDetailPageCopy(t, detail.type, "associations");
	const path = { type: detail.type, unitId: detail.unit.id };
	const baseQuery = { limit: AssociationPageSize, localizationLanguages };
	const associations = useInfiniteQuery({
		queryKey: getApiUnitsByTypeByUnitIdSubjectAssociationsQueryKey({ path, query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUnitsByTypeByUnitIdSubjectAssociations({
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
		<UnitDetailSectionFrame description={labels.description} title={labels.title}>
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

			{detail.type === "series" ? null : (
				<>
					<UnitSeriesMemberships unitId={detail.unit.id} />
					<UnitVariantList context={detail.unit.variantContext} />
				</>
			)}
		</UnitDetailSectionFrame>
	);
}
