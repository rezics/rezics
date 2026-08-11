"use client";

import {
	listCurrentUserStudioContent,
	listCurrentUserStudioContentQueryKey,
	useRecordCurrentUserStudioVisit,
	type ListCurrentUserStudioContentQuery,
} from "@rezics/openapi-tanstack-query";
import { Button, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useQueryStates } from "nuqs";

import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { StudioContentList, type StudioContentListState } from "../components/studio-content-list";
import { StudioSectionToolbar } from "../components/studio-section-toolbar";
import { AnyStudioFilter, studioFilterParsers } from "../model/studio-filters";
import { studioSectionCreateHref, type StudioSectionId } from "../model/studio-section";
import { StudioOverviewHref } from "../routing/studio-routes";

function StudioSectionContent({ sectionId }: { readonly sectionId: StudioSectionId }) {
	const { t } = useTranslation(["create"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [filters, setFilters] = useQueryStates(studioFilterParsers);
	const baseQuery = {
		section: sectionId,
		view: filters.view,
		sort: filters.sort,
		localizationLanguages,
		limit: 30,
		...(filters.permission === AnyStudioFilter ? {} : { permission: filters.permission }),
		...(filters.workState === AnyStudioFilter ? {} : { workState: filters.workState }),
		...(filters.status === AnyStudioFilter ? {} : { status: filters.status }),
		...(filters.visibility === AnyStudioFilter ? {} : { visibility: filters.visibility }),
	} satisfies ListCurrentUserStudioContentQuery;
	const query = useInfiniteQuery({
		queryKey: listCurrentUserStudioContentQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await listCurrentUserStudioContent({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const visit = useRecordCurrentUserStudioVisit({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: listCurrentUserStudioContentQueryKey({ query: baseQuery }),
				}),
		},
	});
	const section = t.create.sections[sectionId];
	const createHref = studioSectionCreateHref(sectionId);
	let listState: StudioContentListState;
	if (query.isPending) listState = { status: "pending" };
	else if (query.isError)
		listState = {
			status: "error",
			error: query.error,
			retry: () => void query.refetch(),
		};
	else
		listState = {
			status: "ready",
			items: query.data.pages.flatMap((page) => page.items),
		};

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={
					createHref ? (
						<Button asChild variant="solid">
							<Link href={createHref}>
								<Plus aria-hidden className="size-4" />
								{t.create.list.create}
							</Link>
						</Button>
					) : undefined
				}
				backHref={StudioOverviewHref}
				backLabel={t.create.workspace.backToOverview}
				description={section.description}
				link={Link}
				title={section.label}
			/>
			<StudioSectionToolbar filters={filters} onChange={(change) => void setFilters(change)} />
			<StudioContentList
				hasNextPage={query.hasNextPage}
				isFetchingNextPage={query.isFetchingNextPage}
				loadMore={() => void query.fetchNextPage()}
				onOpen={(item) => visit.mutate({ path: { unitId: item.id } })}
				sectionId={sectionId}
				sort={filters.sort}
				state={listState}
			/>
		</section>
	);
}

export function StudioSectionPage({ sectionId }: { readonly sectionId: StudioSectionId }) {
	if (sectionId === "zone")
		return (
			<DevelopmentPreviewBoundary>
				<StudioSectionContent sectionId={sectionId} />
			</DevelopmentPreviewBoundary>
		);
	return <StudioSectionContent sectionId={sectionId} />;
}
