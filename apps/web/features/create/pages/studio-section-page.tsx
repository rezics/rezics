"use client";

import {
	listCurrentUserStudioContent,
	listCurrentUserStudioContentQueryKey,
	useRecordCurrentUserStudioVisit,
	type ListCurrentUserStudioContentQuery,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	ChoiceSelect,
	type ChoiceOption,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";

import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	AnyStudioFilter,
	StudioPermissions,
	StudioSorts,
	StudioStatuses,
	StudioViews,
	StudioVisibilities,
	StudioWorkStates,
	studioPermissionParser,
	studioSortParser,
	studioStatusParser,
	studioViewParser,
	studioVisibilityParser,
	studioWorkStateParser,
	type OptionalStudioPermission,
	type OptionalStudioStatus,
	type OptionalStudioVisibility,
	type OptionalStudioWorkState,
	type StudioSort,
	type StudioView,
} from "../model/studio-filters";
import {
	studioSectionCreateHref,
	studioContentHref,
	type StudioSectionId,
} from "../model/studio-section";
import { StudioOverviewHref } from "../routing/studio-routes";

function StudioSectionContent({ sectionId }: { readonly sectionId: StudioSectionId }) {
	const { t } = useTranslation(["actions", "create"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [view, setView] = useQueryState("view", studioViewParser);
	const [permission, setPermission] = useQueryState("permission", studioPermissionParser);
	const [workState, setWorkState] = useQueryState("workState", studioWorkStateParser);
	const [status, setStatus] = useQueryState("status", studioStatusParser);
	const [visibility, setVisibility] = useQueryState("visibility", studioVisibilityParser);
	const [sort, setSort] = useQueryState("sort", studioSortParser);
	const baseQuery = {
		section: sectionId,
		view,
		sort,
		localizationLanguages,
		limit: 30,
		...(permission === AnyStudioFilter ? {} : { permission }),
		...(workState === AnyStudioFilter ? {} : { workState }),
		...(status === AnyStudioFilter ? {} : { status }),
		...(visibility === AnyStudioFilter ? {} : { visibility }),
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
	const viewOptions: readonly ChoiceOption<StudioView>[] = StudioViews.map((value) => ({
		value,
		label: t.create.filters.views[value],
	}));
	const permissionOptions: readonly ChoiceOption<OptionalStudioPermission>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioPermissions.map((value) => ({
			value,
			label: t.create.filters.permissions[value],
		})),
	];
	const workStateOptions: readonly ChoiceOption<OptionalStudioWorkState>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioWorkStates.map((value) => ({
			value,
			label: t.create.filters.workStates[value],
		})),
	];
	const statusOptions: readonly ChoiceOption<OptionalStudioStatus>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioStatuses.map((value) => ({
			value,
			label: t.create.filters.statuses[value],
		})),
	];
	const visibilityOptions: readonly ChoiceOption<OptionalStudioVisibility>[] = [
		{ value: AnyStudioFilter, label: t.create.filters.any },
		...StudioVisibilities.map((value) => ({
			value,
			label: t.create.filters.visibilities[value],
		})),
	];
	const sortOptions: readonly ChoiceOption<StudioSort>[] = StudioSorts.map((value) => ({
		value,
		label: t.create.filters.sorts[value],
	}));

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const items = query.data.pages.flatMap((page) => page.items);
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
			<div className="mb-5 flex flex-wrap gap-2">
				<ChoiceSelect
					ariaLabel={t.create.filters.viewLabel}
					onValueChange={(values) => void setView(values[0] ?? "all")}
					options={viewOptions}
					placeholder={t.create.filters.viewLabel}
					value={[view]}
				/>
				<ChoiceSelect
					ariaLabel={t.create.filters.permissionLabel}
					onValueChange={(values) => void setPermission(values[0] ?? AnyStudioFilter)}
					options={permissionOptions}
					placeholder={t.create.filters.permissionLabel}
					value={[permission]}
				/>
				<ChoiceSelect
					ariaLabel={t.create.filters.workStateLabel}
					onValueChange={(values) => void setWorkState(values[0] ?? AnyStudioFilter)}
					options={workStateOptions}
					placeholder={t.create.filters.workStateLabel}
					value={[workState]}
				/>
				<ChoiceSelect
					ariaLabel={t.create.filters.statusLabel}
					onValueChange={(values) => void setStatus(values[0] ?? AnyStudioFilter)}
					options={statusOptions}
					placeholder={t.create.filters.statusLabel}
					value={[status]}
				/>
				<ChoiceSelect
					ariaLabel={t.create.filters.visibilityLabel}
					onValueChange={(values) => void setVisibility(values[0] ?? AnyStudioFilter)}
					options={visibilityOptions}
					placeholder={t.create.filters.visibilityLabel}
					value={[visibility]}
				/>
				<ChoiceSelect
					ariaLabel={t.create.filters.sortLabel}
					onValueChange={(values) => void setSort(values[0] ?? "recent")}
					options={sortOptions}
					placeholder={t.create.filters.sortLabel}
					value={[sort]}
				/>
			</div>
			{items.length === 0 ? (
				<Card appearance="outlined">
					<CardContent className="p-6 text-sm text-muted-foreground">
						{t.create.list.empty}
					</CardContent>
				</Card>
			) : (
				<ul className="grid gap-3">
					{items.map((item) => (
						<li key={item.id}>
							<Card
								appearance="outlined"
								className="transition-colors hover:border-border"
							>
								<CardContent className="p-0">
									<Link
										className="block rounded-[inherit] p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32"
										href={studioContentHref(sectionId, item.id)}
										onClick={() => visit.mutate({ path: { unitId: item.id } })}
									>
										<span className="block font-medium">
											{item.title ?? t.create.list.untitled}
										</span>
										<span className="mt-2 flex flex-wrap gap-1.5">
											{item.relations.map((relation) => (
												<Badge key={relation} size="sm" variant="secondary">
													{t.create.relations[relation]}
												</Badge>
											))}
											{item.workState === "blocked" ? (
												<Badge size="sm" variant="warning">
													{t.create.relations.blocked}
												</Badge>
											) : null}
										</span>
									</Link>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
			{query.hasNextPage ? (
				<Button
					className="mx-auto mt-5 flex"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
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
