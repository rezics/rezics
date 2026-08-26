"use client";

import {
	type Block,
	type BlockPath,
	type NavigationTarget,
	type SearchFeatureSource,
	type UnitListItemSize,
} from "@rezics/block";
import type { SearchFeatureSurface } from "@rezics/filter";
import {
	useGetApiCollectionsByCollectionIdItems,
	usePostApiSearchZonesByZoneIdDockBlockExecutions,
	usePostApiSearchZonesByZoneIdPagesByPageIdBlockExecutions,
} from "@rezics/openapi-tanstack-query";
import { Button, Cover, IdentityAvatar, UnitCard, cn } from "@rezics/ui";
import { Shelf } from "@rezics/ui/custom/shelf";
import { ExternalLink } from "lucide-react";
import { type ComponentProps, type ComponentType, type ReactNode, useState } from "react";

import { AppLink } from "@/features/application-shell/components/app-link";
import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import type { SearchFeatureRequest } from "@/features/search/search-feature";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import type { ZoneRenderProjection } from "../model/zone-render";
import type { ZoneAggregateBlockState } from "../model/zone-page-aggregate";
import { useZoneAggregateBlockState } from "./zone-page-aggregate-provider";

type UnitListBlock = Extract<Block, { readonly _type: "unit-list" }>;
type UnitListLayout = UnitListBlock["layout"];
export type ZoneUnitListRenderUnit = ZoneRenderProjection["references"]["units"][number];
export type ZoneUnitListSurface =
	| { readonly kind: "dock" }
	| { readonly kind: "page"; readonly pageId: string };

export interface ZoneUnitListSearchResult {
	readonly id: string;
	readonly category: string;
	readonly kind: string;
	readonly title: string | null;
	readonly name?: string | null;
	readonly summary: string | null;
}

export interface ZoneUnitListSearchFacet {
	readonly controlKey?: string;
	readonly field: string;
	readonly options: readonly { readonly value: string }[];
}

export interface ZoneUnitListSearchFeatureProps {
	readonly autoExecute?: boolean;
	readonly children?: ReactNode;
	readonly error: boolean;
	readonly facets?: readonly ZoneUnitListSearchFacet[];
	readonly feature: SearchFeatureSource;
	readonly initialPageSize?: number;
	readonly onExecute: (request: SearchFeatureRequest) => void;
	readonly pending: boolean;
	readonly showSortControl?: boolean;
	readonly surface: SearchFeatureSurface;
}

type ZoneUnitListSearchFeatureComponent = ComponentType<ZoneUnitListSearchFeatureProps>;
type UnitListShelfPresentation = Pick<ComponentProps<typeof Shelf>, "itemSize" | "labels"> & {
	readonly cardHeadingAs: "h2" | "h3";
};
type SearchPresentation = {
	readonly results: "list" | "grid" | "compact";
	readonly showResultCount: boolean;
};
type SearchCountResult = {
	readonly value: number;
	readonly kind: "exact" | "lower-bound";
};
type SearchPage = {
	readonly facets?: readonly ZoneUnitListSearchFacet[];
	readonly results: readonly ZoneUnitListSearchResult[];
	readonly nextCursor?: string;
	readonly total: SearchCountResult;
};
interface SearchExecutionResponse {
	readonly nextCursor?: string;
	readonly facets?: readonly ZoneUnitListSearchFacet[];
	readonly selectionSeed?: string;
	readonly groups: readonly {
		readonly hits: readonly ZoneUnitListSearchResult[];
		readonly total: {
			readonly value: string | number;
			readonly kind: "exact" | "lower-bound";
		};
	}[];
}

const DefaultUnitListItemSize: UnitListItemSize = "md";

function unitListClasses(layout: UnitListLayout): string {
	return cn("grid gap-4", layout === "grid" && "sm:grid-cols-2 lg:grid-cols-3");
}

function ShelfUnitCard({
	cover,
	fallback,
	headingAs,
	href,
	summary,
	title,
}: {
	cover?: { readonly url: string } | null;
	fallback: ReactNode;
	headingAs: "h2" | "h3";
	href: string | null;
	summary?: string | null;
	title: string;
}) {
	if (href)
		return (
			<UnitCard
				cover={cover}
				description={summary || undefined}
				fallback={fallback}
				headingAs={headingAs}
				href={href}
				title={title}
			/>
		);
	const Heading = headingAs;
	return (
		<article className="min-w-0">
			<Cover
				alt={title}
				className="rounded-xl border border-border-weak shadow-sm/5"
				fallback={fallback}
				src={cover?.url}
			/>
			<Heading className="mt-2.5 line-clamp-2 font-semibold text-sm leading-5">{title}</Heading>
			{summary ? (
				<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-5">{summary}</p>
			) : null}
		</article>
	);
}

function ReferencedUnitShelfCard({
	headingAs,
	resolveHref,
	unit,
}: {
	headingAs: "h2" | "h3";
	resolveHref: (unit: ZoneUnitListRenderUnit) => string | null;
	unit: ZoneUnitListRenderUnit;
}) {
	const { t } = useTranslation("ui");
	const localizedTitle = useChineseContentText(unit.title ?? "", unit.language);
	const summary = useChineseContentText(unit.summary ?? "", unit.language);
	const title = localizedTitle || t.unnamed;
	return (
		<ShelfUnitCard
			cover={unit.cover}
			fallback={
				<IdentityAvatar
					avatar={unit.avatar}
					className="size-12 text-base"
					fallback={title.slice(0, 1)}
				/>
			}
			headingAs={headingAs}
			href={resolveHref(unit)}
			summary={summary}
			title={title}
		/>
	);
}

function StaticUnitList({
	ReferencedUnitComponent,
	layout,
	resolveUnitHref,
	shelf,
	units,
}: {
	ReferencedUnitComponent: ComponentType<{ readonly unit: ZoneUnitListRenderUnit }>;
	layout: UnitListLayout;
	resolveUnitHref: (unit: ZoneUnitListRenderUnit) => string | null;
	shelf: UnitListShelfPresentation;
	units: readonly ZoneUnitListRenderUnit[];
}) {
	if (layout === "carousel")
		return (
			<div data-part="items">
				<Shelf itemSize={shelf.itemSize} labels={shelf.labels}>
					{units.map((unit) => (
						<div data-part="item" key={unit.id}>
							<ReferencedUnitShelfCard
								headingAs={shelf.cardHeadingAs}
								resolveHref={resolveUnitHref}
								unit={unit}
							/>
						</div>
					))}
				</Shelf>
			</div>
		);
	return (
		<div
			aria-label={shelf.labels.label}
			className={unitListClasses(layout)}
			data-part="items"
			role="list"
		>
			{units.map((unit) => (
				<div data-part="item" key={unit.id} role="listitem">
					<ReferencedUnitComponent unit={unit} />
				</div>
			))}
		</div>
	);
}

function CollectionUnitList({
	aggregate,
	collectionId,
	layout,
	limit,
	shelf,
	zone,
}: {
	aggregate: ZoneAggregateBlockState;
	collectionId: string;
	layout: UnitListLayout;
	limit: number;
	shelf: UnitListShelfPresentation;
	zone: ZoneRenderProjection["zone"];
}) {
	const { t } = useTranslation(["ui", "zones"]);
	const localizationLanguages = useLocalizationLanguages();
	const automaticallyEnabled =
		aggregate.kind === "legacy" ||
		(aggregate.kind === "skipped" && aggregate.reason === "inactive-tab");
	const [explicitlyEnabled, setExplicitlyEnabled] = useState(false);
	const queryEnabled = automaticallyEnabled || explicitlyEnabled;
	const query = useGetApiCollectionsByCollectionIdItems(
		{
			path: { collectionId },
			query: { limit, localizationLanguages },
		},
		{ query: { enabled: queryEnabled } },
	);
	if (aggregate.kind === "pending")
		return (
			<p className="my-4 text-muted-foreground text-sm" data-part="loading">
				{t.ui.loading}
			</p>
		);
	if (aggregate.kind === "error")
		return (
			<p className="my-4 text-destructive text-sm" data-part="error">
				{t.zones.searchFailed}
			</p>
		);
	if (
		aggregate.kind === "ok" &&
		(aggregate.blockType !== "unit-list" || aggregate.itemKind !== "feed-item")
	)
		return (
			<p className="my-4 text-destructive text-sm" data-part="error">
				{t.zones.searchFailed}
			</p>
		);
	if (aggregate.kind === "skipped" && aggregate.reason === "budget" && !explicitlyEnabled)
		return (
			<Button data-part="action" onClick={() => setExplicitlyEnabled(true)} variant="outline">
				{t.zones.loadSection}
			</Button>
		);
	if (queryEnabled && query.isPending)
		return (
			<p className="my-4 text-muted-foreground text-sm" data-part="loading">
				{t.ui.loading}
			</p>
		);
	if (queryEnabled && query.isError)
		return (
			<p className="my-4 text-destructive text-sm" data-part="error">
				{t.zones.searchFailed}
			</p>
		);
	const aggregateItems =
		aggregate.kind === "ok" &&
		aggregate.blockType === "unit-list" &&
		aggregate.itemKind === "feed-item"
			? aggregate.items
			: undefined;
	const items = aggregateItems
		? aggregateItems.map((content) => ({ key: content.id, content }))
		: (query.data?.items.map((item) => ({
				key: item.membership.targetId,
				content: item.content,
			})) ?? []);
	if (items.length === 0)
		return (
			<p className="my-4 text-muted-foreground text-sm" data-part="empty">
				{t.zones.searchEmpty}
			</p>
		);
	if (layout === "carousel")
		return (
			<div data-part="items">
				<Shelf itemSize={shelf.itemSize} labels={shelf.labels}>
					{items.map((item) => (
						<div data-part="item" key={item.key}>
							<FeedItemCard item={item.content} postContext={{ kind: "zone", zone }} />
						</div>
					))}
				</Shelf>
			</div>
		);
	return (
		<ul aria-label={t.zones.contentList} className={unitListClasses(layout)} data-part="items">
			{items.map((item) => (
				<li data-part="item" key={item.key}>
					<FeedItemCard item={item.content} postContext={{ kind: "zone", zone }} />
				</li>
			))}
		</ul>
	);
}

function SearchResults({
	presentation,
	resolveResultHref,
	results,
	shelf,
	total,
	unitListLayout,
}: {
	presentation: Pick<SearchPresentation, "results" | "showResultCount">;
	resolveResultHref: (result: ZoneUnitListSearchResult) => string | null;
	results: readonly ZoneUnitListSearchResult[];
	shelf: UnitListShelfPresentation;
	total: SearchCountResult;
	unitListLayout: UnitListLayout;
}) {
	const { t } = useTranslation("zones");
	const { t: search } = useTranslation("search");
	if (results.length === 0)
		return (
			<p className="mt-4 text-muted-foreground text-sm" data-part="empty">
				{t.searchEmpty}
			</p>
		);
	const resultPresentation = (result: ZoneUnitListSearchResult) => ({
		href: resolveResultHref(result),
		title: result.title ?? result.name ?? t.untitledResult,
	});
	return (
		<div className="mt-4 grid gap-3" data-part="items">
			{presentation.showResultCount ? (
				<p className="text-muted-foreground text-sm">
					{total.kind === "exact"
						? search.resultCount({ count: total.value })
						: search.atLeastResultCount({ count: total.value })}
				</p>
			) : null}
			{unitListLayout === "carousel" ? (
				<Shelf itemSize={shelf.itemSize} labels={shelf.labels}>
					{results.map((result) => {
						const { href, title } = resultPresentation(result);
						return (
							<div data-part="item" key={`${result.kind}:${result.id}`}>
								<ShelfUnitCard
									fallback={<span aria-hidden>{title.slice(0, 1)}</span>}
									headingAs={shelf.cardHeadingAs}
									href={href}
									summary={result.summary}
									title={title}
								/>
							</div>
						);
					})}
				</Shelf>
			) : (
				<ul
					aria-label={t.searchResults}
					className={cn(
						"grid gap-2",
						presentation.results === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
					)}
				>
					{results.map((result) => {
						const { href, title } = resultPresentation(result);
						const content = (
							<div className="rounded-lg border border-border-weak px-3 py-2 transition-colors hover:bg-accent">
								<p className="font-medium text-sm">{title}</p>
								{result.summary ? (
									<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
										{result.summary}
									</p>
								) : null}
							</div>
						);
						return (
							<li data-part="item" key={`${result.kind}:${result.id}`}>
								{href ? <AppLink href={href}>{content}</AppLink> : content}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function toSearchPage(value: SearchExecutionResponse): SearchPage {
	const totals = value.groups.map((group) => group.total);
	return {
		facets: value.facets,
		results: value.groups.flatMap((group) => group.hits),
		nextCursor: value.nextCursor,
		total: {
			kind: totals.some((total) => total.kind === "lower-bound") ? "lower-bound" : "exact",
			value: totals.reduce((total, current) => total + Number(current.value), 0),
		},
	};
}

function ZoneSearchUnitListBlock({
	SearchFeatureComponent,
	aggregate,
	error,
	execute,
	feature,
	layout,
	limit,
	pending,
	presentation,
	resolveResultHref,
	shelf,
}: {
	SearchFeatureComponent: ZoneUnitListSearchFeatureComponent;
	readonly aggregate: ZoneAggregateBlockState;
	readonly error: boolean;
	readonly execute: (
		request: SearchFeatureRequest,
		selectionSeed?: string,
	) => Promise<SearchExecutionResponse>;
	readonly feature: SearchFeatureSource;
	readonly layout: UnitListLayout;
	readonly limit: number;
	readonly pending: boolean;
	readonly presentation: SearchPresentation;
	readonly resolveResultHref: (result: ZoneUnitListSearchResult) => string | null;
	readonly shelf: UnitListShelfPresentation;
}) {
	const { t } = useTranslation(["ui", "zones"]);
	const [page, setPage] = useState<SearchPage>();
	const [selectionSeed, setSelectionSeed] = useState<string>();
	const aggregatePage: SearchPage | undefined =
		aggregate.kind === "ok" &&
		aggregate.blockType === "unit-list" &&
		aggregate.itemKind === "search-hit"
			? {
					facets: aggregate.facets,
					results: aggregate.items,
					nextCursor: aggregate.nextCursor,
					total: aggregate.total ?? { kind: "exact", value: aggregate.items.length },
				}
			: undefined;
	if (aggregate.kind === "pending")
		return (
			<p className="my-4 text-muted-foreground text-sm" data-part="loading">
				{t.ui.loading}
			</p>
		);
	if (
		aggregate.kind === "error" ||
		(aggregate.kind === "ok" &&
			(aggregate.blockType !== "unit-list" || aggregate.itemKind !== "search-hit"))
	)
		return (
			<p className="my-4 text-destructive text-sm" data-part="error">
				{t.zones.searchFailed}
			</p>
		);
	const displayedPage = page ?? aggregatePage;
	return (
		<SearchFeatureComponent
			autoExecute={
				aggregate.kind === "legacy" ||
				(aggregate.kind === "skipped" && aggregate.reason === "inactive-tab")
			}
			error={error}
			facets={displayedPage?.facets}
			feature={feature}
			initialPageSize={Math.min(limit, 50)}
			onExecute={(request) => {
				void execute(
					request,
					selectionSeed ?? (aggregate.kind === "ok" ? aggregate.selectionSeed : undefined),
				).then(
					(response) => {
						setPage(toSearchPage(response));
						if (response.selectionSeed) setSelectionSeed(response.selectionSeed);
					},
					() => undefined,
				);
			}}
			pending={pending}
			showSortControl={false}
			surface="search"
		>
			{displayedPage ? (
				<SearchResults
					presentation={presentation}
					resolveResultHref={resolveResultHref}
					results={displayedPage.results.slice(0, limit)}
					shelf={shelf}
					total={displayedPage.total}
					unitListLayout={layout}
				/>
			) : null}
		</SearchFeatureComponent>
	);
}

function SearchUnitList({
	SearchFeatureComponent,
	aggregate,
	blockPath,
	feature,
	layout,
	limit,
	pageId,
	resolveResultHref,
	shelf,
	zoneId,
}: {
	SearchFeatureComponent: ZoneUnitListSearchFeatureComponent;
	aggregate: ZoneAggregateBlockState;
	blockPath: BlockPath;
	feature: SearchFeatureSource;
	layout: UnitListLayout;
	limit: number;
	pageId?: string;
	resolveResultHref: (result: ZoneUnitListSearchResult) => string | null;
	shelf: UnitListShelfPresentation;
	zoneId: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const dockMutation = usePostApiSearchZonesByZoneIdDockBlockExecutions();
	const pageMutation = usePostApiSearchZonesByZoneIdPagesByPageIdBlockExecutions();
	const presentation = {
		results: layout === "grid" || layout === "carousel" ? "grid" : "list",
		pagination: "load-more",
		showResultCount: false,
	} as const;
	if (pageId === undefined)
		return (
			<ZoneSearchUnitListBlock
				SearchFeatureComponent={SearchFeatureComponent}
				aggregate={aggregate}
				error={dockMutation.isError}
				execute={(body, selectionSeed) =>
					dockMutation.mutateAsync({
						body: {
							state: body.state,
							...(selectionSeed ? { selectionSeed } : {}),
							localizationLanguages,
							path: [...blockPath],
						},
						path: { zoneId },
					})
				}
				feature={feature}
				layout={layout}
				limit={limit}
				pending={dockMutation.isPending}
				presentation={presentation}
				resolveResultHref={resolveResultHref}
				shelf={shelf}
			/>
		);
	return (
		<ZoneSearchUnitListBlock
			SearchFeatureComponent={SearchFeatureComponent}
			aggregate={aggregate}
			error={pageMutation.isError}
			execute={(body, selectionSeed) =>
				pageMutation.mutateAsync({
					body: {
						state: body.state,
						...(selectionSeed ? { selectionSeed } : {}),
						localizationLanguages,
						path: [...blockPath],
					},
					path: { pageId, zoneId },
				})
			}
			feature={feature}
			layout={layout}
			limit={limit}
			pending={pageMutation.isPending}
			presentation={presentation}
			resolveResultHref={resolveResultHref}
			shelf={shelf}
		/>
	);
}

export function ZoneUnitListBlock({
	ReferencedUnitComponent,
	SearchFeatureComponent,
	block,
	blockPath,
	resolveNavigationHref,
	resolveSearchResultHref,
	resolveUnitHref,
	surface,
	units,
	zone,
}: {
	ReferencedUnitComponent: ComponentType<{ readonly unit: ZoneUnitListRenderUnit }>;
	SearchFeatureComponent: ZoneUnitListSearchFeatureComponent;
	block: UnitListBlock;
	blockPath: BlockPath;
	resolveNavigationHref: (target: NavigationTarget) => string | null;
	resolveSearchResultHref: (result: ZoneUnitListSearchResult) => string | null;
	resolveUnitHref: (unit: ZoneUnitListRenderUnit) => string | null;
	surface: ZoneUnitListSurface | null;
	units: ReadonlyMap<string, ZoneUnitListRenderUnit>;
	zone: ZoneRenderProjection["zone"];
}) {
	const { t } = useTranslation(["feed", "ui"]);
	const aggregate = useZoneAggregateBlockState(surface?.kind, blockPath);
	const headingUnit =
		block.presentation?.headingUnitId && block.presentation.headingUnitId !== "selected"
			? units.get(block.presentation.headingUnitId)
			: undefined;
	const prefixUnit = block.presentation?.headingPrefixUnitId
		? units.get(block.presentation.headingPrefixUnitId)
		: undefined;
	const selectedUnit = aggregate.kind === "ok" ? aggregate.selected : undefined;
	const staticHeading = useChineseContentText(headingUnit?.title ?? "", headingUnit?.language);
	const prefixHeading = useChineseContentText(prefixUnit?.title ?? "", prefixUnit?.language);
	const selectedHeading = useChineseContentText(selectedUnit?.title ?? "", selectedUnit?.language);
	const heading =
		block.presentation?.headingUnitId === "selected"
			? [prefixHeading, selectedHeading].filter(Boolean).join(" ")
			: staticHeading;
	const viewAllTarget = block.presentation?.viewAllTarget;
	const viewAllHref = viewAllTarget ? resolveNavigationHref(viewAllTarget) : null;
	const externalViewAll = viewAllTarget?.kind === "external";
	if (aggregate.kind === "hidden") return null;
	const shelf = {
		cardHeadingAs: heading ? "h3" : "h2",
		itemSize: block.presentation?.itemSize ?? DefaultUnitListItemSize,
		labels: {
			label: heading || t.ui.shelf.label,
			previous: t.ui.shelf.previous,
			next: t.ui.shelf.next,
			page: ({ page, pageCount }) => t.ui.shelf.page({ page, pageCount }),
			item: ({ item, itemCount }) => t.ui.shelf.item({ item, itemCount }),
		},
	} satisfies UnitListShelfPresentation;
	let content: ReactNode = null;
	if (block.source.kind === "collection")
		content = (
			<CollectionUnitList
				aggregate={aggregate}
				collectionId={block.source.collectionId}
				layout={block.layout}
				limit={block.limit}
				shelf={shelf}
				zone={zone}
			/>
		);
	else if (block.source.kind === "search" || block.source.kind === "derived")
		content = surface ? (
			<SearchUnitList
				SearchFeatureComponent={SearchFeatureComponent}
				aggregate={aggregate}
				blockPath={blockPath}
				feature={block.source.kind === "search" ? block.source.feature : block.source.query.feature}
				layout={block.layout}
				limit={block.limit}
				pageId={surface.kind === "page" ? surface.pageId : undefined}
				resolveResultHref={resolveSearchResultHref}
				shelf={shelf}
				zoneId={zone.id}
			/>
		) : null;
	else {
		const resolvedUnits = block.source.unitIds
			.map((id) => units.get(id))
			.filter((unit): unit is ZoneUnitListRenderUnit => Boolean(unit))
			.slice(0, block.limit);
		content = (
			<StaticUnitList
				ReferencedUnitComponent={ReferencedUnitComponent}
				layout={block.layout}
				resolveUnitHref={resolveUnitHref}
				shelf={shelf}
				units={resolvedUnits}
			/>
		);
	}
	if (!content) return null;
	return (
		<section className="my-6">
			{heading || viewAllHref ? (
				<div className="mb-4 flex min-w-0 items-center justify-between gap-4">
					{heading ? (
						<h2 className="min-w-0 font-semibold text-xl" data-part="heading">
							{heading}
						</h2>
					) : null}
					{viewAllHref ? (
						<AppLink
							className="ms-auto inline-flex shrink-0 items-center gap-1.5 font-medium text-primary text-sm hover:underline"
							data-part="view-all"
							href={viewAllHref}
							rel={externalViewAll ? "noopener noreferrer" : undefined}
							target={externalViewAll ? "_blank" : undefined}
						>
							{t.feed.viewAll}
							{externalViewAll ? <ExternalLink aria-hidden className="size-3.5" /> : null}
						</AppLink>
					) : null}
				</div>
			) : null}
			{content}
		</section>
	);
}
