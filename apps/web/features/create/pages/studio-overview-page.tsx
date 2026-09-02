"use client";

import {
	useListCurrentUserContributionResources,
	useListCurrentUserStudioContent,
	useRecordCurrentUserStudioVisit,
} from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { StudioCreateActions } from "../components/studio-create-actions";
import type { StudioContentItem } from "../components/studio-content-card";
import { StudioContentList, type StudioContentListState } from "../components/studio-content-list";
import {
	StudioSectionGroups,
	type StudioSectionGroupId,
	type StudioSectionId,
} from "../model/studio-section";
import { useStudioWorkspaceSections } from "../components/studio-workspace";

const OverviewItemLimit = 4;

function StudioOverviewList({
	emptyMessage,
	mode,
	onOpen,
	state,
	title,
}: {
	readonly emptyMessage: string;
	readonly mode: "contributions" | "workspace";
	readonly onOpen: (item: StudioContentItem) => void;
	readonly state: StudioContentListState;
	readonly title: string;
}) {
	return (
		<section aria-labelledby={`studio-overview-${mode}`}>
			<h2
				className="mb-4 font-heading text-xl font-semibold tracking-tight"
				id={`studio-overview-${mode}`}
			>
				{title}
			</h2>
			<StudioContentList
				emptyMessage={emptyMessage}
				hasNextPage={false}
				isFetchingNextPage={false}
				loadMore={() => undefined}
				mode={mode}
				onOpen={onOpen}
				state={state}
			/>
		</section>
	);
}

export function StudioOverviewPage() {
	const { t } = useTranslation(["create"]);
	const localizationLanguages = useLocalizationLanguages();
	const sections = useStudioWorkspaceSections();
	const queryClient = useQueryClient();
	const workspace = useListCurrentUserStudioContent({
		query: { localizationLanguages, limit: OverviewItemLimit },
	});
	const contributions = useListCurrentUserContributionResources({
		query: { localizationLanguages, limit: OverviewItemLimit },
	});
	const visit = useRecordCurrentUserStudioVisit({
		mutation: {
			onSuccess: () => queryClient.invalidateQueries({ queryKey: workspace.queryKey }),
		},
	});
	const workspaceState: StudioContentListState = workspace.isPending
		? { status: "pending" }
		: workspace.isError
			? { status: "error", error: workspace.error, retry: () => void workspace.refetch() }
			: {
					status: "ready",
					items: workspace.data.items.map((resource) => ({
						kind: "workspace" as const,
						resource,
					})),
				};
	const contributionState: StudioContentListState = contributions.isPending
		? { status: "pending" }
		: contributions.isError
			? {
					status: "error",
					error: contributions.error,
					retry: () => void contributions.refetch(),
				}
			: {
					status: "ready",
					items: contributions.data.items.map((resource) => ({
						kind: "contribution" as const,
						resource,
					})),
				};
	const sectionById = new Map(sections.map((section) => [section.id, section]));

	return (
		<div className="grid gap-10">
			<StudioOverviewList
				emptyMessage={t.create.overview.empty.workspace}
				mode="workspace"
				onOpen={(item) => {
					if (item.kind === "workspace") visit.mutate({ path: { unitId: item.resource.id } });
				}}
				state={workspaceState}
				title={t.create.overview.continueTitle}
			/>

			<section aria-labelledby="studio-overview-create">
				<h2
					className="mb-4 font-heading text-xl font-semibold tracking-tight"
					id="studio-overview-create"
				>
					{t.create.overview.createTitle}
				</h2>
				<nav aria-label={t.create.overview.createTitle} className="grid gap-4 xl:grid-cols-2">
					{StudioSectionGroups.map((group) => (
						<StudioSectionGroup
							groupId={group.id}
							key={group.id}
							sectionIds={group.sectionIds}
							sectionById={sectionById}
						/>
					))}
				</nav>
			</section>

			<StudioOverviewList
				emptyMessage={t.create.overview.empty.contributions}
				mode="contributions"
				onOpen={() => undefined}
				state={contributionState}
				title={t.create.overview.recentContributionsTitle}
			/>
		</div>
	);
}

function StudioSectionGroup({
	groupId,
	sectionById,
	sectionIds,
}: {
	readonly groupId: StudioSectionGroupId;
	readonly sectionById: ReadonlyMap<
		StudioSectionId,
		ReturnType<typeof useStudioWorkspaceSections>[number]
	>;
	readonly sectionIds: readonly StudioSectionId[];
}) {
	const { t } = useTranslation(["create"]);
	return (
		<Card appearance="outlined">
			<CardContent className="p-5">
				<h3 className="font-heading font-semibold">{t.create.overview.groups[groupId]}</h3>
				<ul className="mt-3 divide-y divide-border-weak">
					{sectionIds.map((sectionId) => {
						const section = sectionById.get(sectionId);
						if (!section) throw new Error(`Missing Studio section: ${sectionId}`);
						const Icon = section.icon;
						return (
							<li className="grid gap-3 py-4 first:pt-1 last:pb-1" key={sectionId}>
								<Link
									className="group flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32"
									href={section.href}
								>
									<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
										<Icon aria-hidden className="size-4" />
									</span>
									<span className="min-w-0 flex-1 font-medium">{section.label}</span>
									{section.badge ? (
										<Badge size="sm" variant="secondary">
											{section.badge}
										</Badge>
									) : null}
									<ChevronRight
										aria-hidden
										className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
									/>
								</Link>
								<StudioCreateActions context="overview" sectionId={sectionId} />
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
