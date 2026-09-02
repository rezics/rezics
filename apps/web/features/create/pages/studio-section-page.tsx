"use client";

import {
	listCurrentUserContributionResources,
	listCurrentUserContributionResourcesQueryKey,
	listCurrentUserStudioContent,
	listCurrentUserStudioContentQueryKey,
	useRecordCurrentUserStudioVisit,
	type ListCurrentUserContributionResourcesQuery,
	type ListCurrentUserStudioContentQuery,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useQueryStates } from "nuqs";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { StudioContentList, type StudioContentListState } from "../components/studio-content-list";
import { StudioSectionToolbar } from "../components/studio-section-toolbar";
import { AnyStudioFilter, studioFilterParsers } from "../model/studio-filters";
import { studioSectionCreateActions, type StudioSectionId } from "../model/studio-section";
import { StudioOverviewHref } from "../routing/studio-routes";

function StudioSectionCreateActions({ sectionId }: { readonly sectionId: StudioSectionId }) {
	const { t } = useTranslation(["create", "tags"]);
	const actions = studioSectionCreateActions(sectionId);
	return (
		<div className="flex flex-wrap gap-2">
			{actions.map((action) => (
				<div className="flex items-center gap-2" key={action.kind}>
					<Button asChild variant={action.kind === "tag_path" ? "outline" : "solid"}>
						<Link href={action.href}>
							{action.kind === "section" ? <Plus aria-hidden className="size-4" /> : null}
							{action.kind === "tag_path"
								? t.tags.createPath.title
								: sectionId === "tag"
									? t.tags.create.title
									: t.create.list.create}
						</Link>
					</Button>
					<Badge size="sm" variant="outline">
						{t.create.lifecycle[action.lifecycle]}
					</Badge>
				</div>
			))}
		</div>
	);
}

function StudioSectionContent({ sectionId }: { readonly sectionId: StudioSectionId }) {
	const { t } = useTranslation(["create"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [filters, setFilters] = useQueryStates(studioFilterParsers);
	const workspaceBaseQuery = {
		section: sectionId,
		source: filters.source,
		localizationLanguages,
		limit: 30,
		...(filters.status === AnyStudioFilter ? {} : { status: filters.status }),
		...(filters.visibility === AnyStudioFilter ? {} : { visibility: filters.visibility }),
	} satisfies ListCurrentUserStudioContentQuery;
	const contributionBaseQuery = {
		section: sectionId,
		kind: filters.kind,
		localizationLanguages,
		limit: 30,
	} satisfies ListCurrentUserContributionResourcesQuery;
	const workspaceQuery = useInfiniteQuery({
		queryKey: listCurrentUserStudioContentQueryKey({ query: workspaceBaseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await listCurrentUserStudioContent({
				query: { ...workspaceBaseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		enabled: filters.mode === "workspace",
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const contributionQuery = useInfiniteQuery({
		queryKey: listCurrentUserContributionResourcesQueryKey({ query: contributionBaseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await listCurrentUserContributionResources({
				query: { ...contributionBaseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		enabled: filters.mode === "contributions",
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const visit = useRecordCurrentUserStudioVisit({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: listCurrentUserStudioContentQueryKey({ query: workspaceBaseQuery }),
				}),
		},
	});
	let listState: StudioContentListState;
	if (filters.mode === "workspace") {
		if (workspaceQuery.isPending) listState = { status: "pending" };
		else if (workspaceQuery.isError)
			listState = {
				status: "error",
				error: workspaceQuery.error,
				retry: () => void workspaceQuery.refetch(),
			};
		else
			listState = {
				status: "ready",
				items: workspaceQuery.data.pages.flatMap((page) =>
					page.items.map((resource) => ({ kind: "workspace" as const, resource })),
				),
			};
	} else if (contributionQuery.isPending) listState = { status: "pending" };
	else if (contributionQuery.isError)
		listState = {
			status: "error",
			error: contributionQuery.error,
			retry: () => void contributionQuery.refetch(),
		};
	else
		listState = {
			status: "ready",
			items: contributionQuery.data.pages.flatMap((page) =>
				page.items.map((resource) => ({ kind: "contribution" as const, resource })),
			),
		};
	const section = t.create.sections[sectionId];

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={<StudioSectionCreateActions sectionId={sectionId} />}
				backHref={StudioOverviewHref}
				backLabel={t.create.workspace.backToOverview}
				description={section.description}
				link={Link}
				title={section.label}
			/>
			<StudioSectionToolbar filters={filters} onChange={(change) => void setFilters(change)} />
			<StudioContentList
				hasNextPage={
					filters.mode === "workspace" ? workspaceQuery.hasNextPage : contributionQuery.hasNextPage
				}
				isFetchingNextPage={
					filters.mode === "workspace"
						? workspaceQuery.isFetchingNextPage
						: contributionQuery.isFetchingNextPage
				}
				loadMore={() => {
					if (filters.mode === "workspace") void workspaceQuery.fetchNextPage();
					else void contributionQuery.fetchNextPage();
				}}
				mode={filters.mode}
				onOpen={(item) => {
					if (item.kind === "workspace") visit.mutate({ path: { unitId: item.resource.id } });
				}}
				sectionId={sectionId}
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
