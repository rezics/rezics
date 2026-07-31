"use client";

import {
	Block as BlockContract,
	isDocument,
	type Block,
	type NavigationItem,
	type NavigationTarget,
	type SearchFeatureSource,
} from "@rezics/block";
import {
	createSimpleFeedFilter,
	mergeUnitFilter,
	parseSearchFeatureDefinition,
	type SearchControlValue,
	type SearchFeatureSurface,
	type SearchTemplateId,
	type SimpleFeedContentKind,
} from "@rezics/filter";
import {
	useGetApiCollectionsByCollectionIdItems,
	useGetApiSearchFeaturesByTemplate,
	useGetApiSearchZonesByZoneIdFeature,
	usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute,
	usePostApiSearchZonesByZoneIdFeedBlocksByBlockKeyExecute,
	usePostApiSearchZonesByZoneIdPagesByPageIdBlocksByBlockKeyExecute,
	type PostApiSearchZonesByZoneIdFeedBlocksByBlockKeyExecuteStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	IdentityAvatar,
	Menu,
	MenuContent,
	MenuItem,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
	Separator,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@rezics/ui";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { normalizePortableText } from "@rezics/portable-text";

import { AppLink } from "@/features/application-shell/components/app-link";
import { FeedItemCard, type FeedItem } from "@/features/content-feed/components/feed-item-card";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import {
	LocalizedText,
	useChineseContentText,
} from "@/features/content-language-display/chinese-content-display-context";
import { FeedContentSelector } from "@/features/content-feed/components/feed-content-selector";
import { FeedList } from "@/features/content-feed/components/feed-list";
import type { FeedContinuationState } from "@/features/content-feed/model/feed-continuation";
import { postHref } from "@/features/posts/url";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";
import { zonePageHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { workZoneFeedContentKinds } from "../model/work-zone-feed";
import type { ZoneRenderNavigation, ZoneRenderProjection } from "../model/zone-render";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];
type RenderAsset = ZoneRenderProjection["references"]["assets"][number];
type ZoneBlockSurface =
	{ readonly kind: "dock" } | { readonly kind: "page"; readonly pageId: string };
type ZoneNavigationLayout = "horizontal" | "vertical";
type NavigationLeafItem = Extract<NavigationItem, { target: unknown }>;
type NavigationGroupItem = Extract<NavigationItem, { children: unknown }>;
type SearchResult = {
	readonly id: string;
	readonly category: string;
	readonly kind: string;
	readonly title: string | null;
	readonly name?: string | null;
	readonly summary: string | null;
};
type SearchPresentation = {
	readonly results: "list" | "grid" | "compact";
	readonly showResultCount: boolean;
};
type FeedPresentation = Extract<Block, { readonly _type: "feed" }>["presentation"];
type SearchFacet = {
	readonly controlKey?: string;
	readonly field: string;
	readonly options: readonly { readonly value: string }[];
};
type SearchPage = {
	readonly facets?: readonly SearchFacet[];
	readonly results: readonly SearchResult[];
	readonly nextCursor?: string;
	readonly total: number;
};
type ZoneFeedExecutionResponse = PostApiSearchZonesByZoneIdFeedBlocksByBlockKeyExecuteStatus200;
type ZoneFeedRequest = SearchFeatureRequest;
type ZoneFeedPage = {
	readonly facets?: readonly SearchFacet[];
	readonly items: readonly FeedItem[];
	readonly nextCursor?: string;
	readonly total: number;
};

interface ZoneBlockContextValue {
	readonly baseHref: string;
	readonly projection: ZoneRenderProjection;
	readonly units: ReadonlyMap<string, RenderUnit>;
	readonly assets: ReadonlyMap<string, RenderAsset>;
	readonly navigations: ReadonlyMap<string, ZoneRenderNavigation>;
}

const ZoneBlockContext = createContext<ZoneBlockContextValue | null>(null);
const ZoneBlockSurfaceContext = createContext<ZoneBlockSurface | null>(null);
const ZoneNavigationLayoutContext = createContext<ZoneNavigationLayout>("horizontal");

function useZoneBlocks() {
	const value = useContext(ZoneBlockContext);
	if (!value) throw new Error("Zone Block renderer is missing its render projection");
	return value;
}

function unitHref(unit: RenderUnit, context?: ZoneBlockContextValue): string | null {
	if (unit.kind === "post" && context)
		return postHref(unit.id, { kind: "zone", zone: context.projection.zone });
	return unitIdHref(unit.kind, unit.id);
}

function unitIdHref(kind: string, id: string): string | null {
	if (["book", "software", "media"].includes(kind)) return `/units/${kind}/${id}`;
	if (kind === "profile") return `/user/${id}`;
	if (kind === "realm") return `/realm/${id}`;
	if (kind === "zone") return `/zone/${id}`;
	if (kind === "post") return `/posts/${id}`;
	if (kind === "collection") return `/collections/${id}`;
	if (kind === "poll") return `/polls/${id}`;
	if (kind === "entity") return `/entities/${id}`;
	return null;
}

function navigationHref(target: NavigationTarget, context: ZoneBlockContextValue): string | null {
	if (target.kind === "external") return target.url;
	const targetUnit = context.units.get(target.unitId);
	if (targetUnit?.kind === "zone_page")
		return zonePageHref(context.projection.zone, {
			id: targetUnit.id,
			slug: targetUnit.zonePageSlug,
		});
	return targetUnit ? unitHref(targetUnit, context) : null;
}

function ReferencedUnit({ unit, appearance }: { unit: RenderUnit; appearance: string }) {
	const context = useZoneBlocks();
	const title = useChineseContentText(unit.title ?? "", unit.language);
	const summary = useChineseContentText(unit.summary ?? "", unit.language);
	const href =
		unit.kind === "zone_page"
			? zonePageHref(context.projection.zone, {
					id: unit.id,
					slug: unit.zonePageSlug,
				})
			: unitHref(unit, context);
	const avatar =
		appearance === "cover"
			? unit.cover
				? { type: "image" as const, image: unit.cover }
				: null
			: unit.avatar;
	const content = (
		<div
			className={cn(
				"flex min-w-0 items-center gap-3",
				appearance !== "inline" && "rounded-xl border border-border-weak bg-card p-4",
			)}
		>
			{avatar ? (
				<IdentityAvatar
					avatar={avatar}
					className={appearance === "cover" ? "size-16 rounded-lg" : "size-10"}
					fallback={title.slice(0, 1)}
				/>
			) : null}
			<div className="min-w-0">
				<p className="truncate font-semibold">{title}</p>
				{appearance !== "inline" && summary ? (
					<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">{summary}</p>
				) : null}
			</div>
		</div>
	);
	return href ? <AppLink href={href}>{content}</AppLink> : content;
}

const RootMenuPositioning = { placement: "bottom-start", gutter: 4 } as const;
const NestedMenuPositioning = { placement: "right-start", gutter: -2 } as const;
const MenuHoverCloseDelay = 180;

function navigationLabelUnit(
	item: NavigationItem,
	context: ZoneBlockContextValue,
): RenderUnit | undefined {
	return context.units.get(item.labelUnitId);
}

function NavigationLeaf({ item }: { item: NavigationLeafItem }) {
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const labelUnit = navigationLabelUnit(item, context);
	const label = useChineseContentText(labelUnit?.title ?? "", labelUnit?.language);
	const href = navigationHref(item.target, context);
	if (!label || !href) return null;
	const external = item.target.kind === "external";
	return (
		<AppLink
			className={cn(
				"inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
				layout === "vertical" && "w-full",
			)}
			href={href}
			rel={external ? "noopener noreferrer" : undefined}
			target={external ? "_blank" : undefined}
		>
			{label}
			{external ? <ExternalLink aria-hidden className="size-3.5" /> : null}
		</AppLink>
	);
}

interface NavigationHoverBoundary {
	onPointerEnter: () => void;
	onPointerLeave: () => void;
}

function NavigationMenuLeaf({ item }: { item: NavigationLeafItem }) {
	const context = useZoneBlocks();
	const labelUnit = navigationLabelUnit(item, context);
	const label = useChineseContentText(labelUnit?.title ?? "", labelUnit?.language);
	const href = navigationHref(item.target, context);
	if (!label || !href) return null;
	const external = item.target.kind === "external";
	return (
		<MenuItem asChild value={item._key}>
			<AppLink
				href={href}
				rel={external ? "noopener noreferrer" : undefined}
				target={external ? "_blank" : undefined}
			>
				{label}
				{external ? <ExternalLink aria-hidden className="ms-auto size-3.5" /> : null}
			</AppLink>
		</MenuItem>
	);
}

function NavigationSubmenu({
	hoverBoundary,
	item,
}: {
	hoverBoundary: NavigationHoverBoundary;
	item: NavigationGroupItem;
}) {
	const context = useZoneBlocks();
	const labelUnit = navigationLabelUnit(item, context);
	const label = useChineseContentText(labelUnit?.title ?? "", labelUnit?.language);
	if (!label) return null;
	return (
		<MenuSub positioning={NestedMenuPositioning}>
			<MenuSubTrigger>{label}</MenuSubTrigger>
			<MenuSubContent
				className="min-w-52"
				onPointerEnter={hoverBoundary.onPointerEnter}
				onPointerLeave={hoverBoundary.onPointerLeave}
			>
				{item.children.map((child) => (
					<NavigationMenuNode
						hoverBoundary={hoverBoundary}
						item={child}
						key={child._key}
					/>
				))}
			</MenuSubContent>
		</MenuSub>
	);
}

function NavigationMenuNode({
	hoverBoundary,
	item,
}: {
	hoverBoundary: NavigationHoverBoundary;
	item: NavigationItem;
}) {
	return "target" in item ? (
		<NavigationMenuLeaf item={item} />
	) : (
		<NavigationSubmenu hoverBoundary={hoverBoundary} item={item} />
	);
}

function NavigationDropdown({
	hoverBoundary,
	item,
	onOpenChange,
	open,
}: {
	hoverBoundary: NavigationHoverBoundary;
	item: NavigationGroupItem;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const labelUnit = navigationLabelUnit(item, context);
	const label = useChineseContentText(labelUnit?.title ?? "", labelUnit?.language);
	if (!label) return null;
	return (
		<Menu
			onOpenChange={({ open: nextOpen }) => onOpenChange(nextOpen)}
			open={open}
			positioning={RootMenuPositioning}
		>
			<MenuTrigger
				aria-label={t.openMenu({ label })}
				className={cn(
					"flex min-h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-3 font-medium text-sm hover:bg-accent data-[state=open]:bg-accent",
					layout === "vertical" && "w-full justify-between",
				)}
				onPointerEnter={hoverBoundary.onPointerEnter}
				onPointerLeave={hoverBoundary.onPointerLeave}
			>
				{label}
				<ChevronDown aria-hidden className="size-3.5" />
			</MenuTrigger>
			<MenuContent
				className="min-w-52"
				onPointerEnter={hoverBoundary.onPointerEnter}
				onPointerLeave={hoverBoundary.onPointerLeave}
			>
				{item.children.map((child) => (
					<NavigationMenuNode
						hoverBoundary={hoverBoundary}
						item={child}
						key={child._key}
					/>
				))}
			</MenuContent>
		</Menu>
	);
}

export function ZoneNavigationMenu({ navigationId }: { navigationId: string }) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
	const closeTimeoutRef = useRef<number | null>(null);
	const navigation = context.navigations.get(navigationId);

	const cancelScheduledClose = () => {
		if (closeTimeoutRef.current === null) return;
		window.clearTimeout(closeTimeoutRef.current);
		closeTimeoutRef.current = null;
	};
	const openGroup = (key: string) => {
		cancelScheduledClose();
		setOpenGroupKey(key);
	};
	const scheduleClose = () => {
		cancelScheduledClose();
		closeTimeoutRef.current = window.setTimeout(() => {
			setOpenGroupKey(null);
			closeTimeoutRef.current = null;
		}, MenuHoverCloseDelay);
	};

	useEffect(
		() => () => {
			if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
		},
		[],
	);

	if (!navigation) return null;
	return (
		<nav
			aria-label={t.navigation}
			className={cn(
				"min-w-0 gap-1",
				layout === "horizontal" ? "flex shrink-0 items-center" : "grid",
			)}
		>
			{navigation.document.items.map((item) => {
				if ("target" in item) return <NavigationLeaf item={item} key={item._key} />;
				const hoverBoundary = {
					onPointerEnter: () => openGroup(item._key),
					onPointerLeave: scheduleClose,
				};
				return (
					<NavigationDropdown
						hoverBoundary={hoverBoundary}
						item={item}
						key={item._key}
						onOpenChange={(open) => {
							cancelScheduledClose();
							setOpenGroupKey((current) =>
								open ? item._key : current === item._key ? null : current,
							);
						}}
						open={openGroupKey === item._key}
					/>
				);
			})}
		</nav>
	);
}

function EmbeddedPortableTextBlock({ value }: { value: unknown }) {
	if (!isDocument(BlockContract, value)) return null;
	return <ZoneBlock block={value} />;
}

const portableTextBlockTypes = {
	"portable-text": EmbeddedPortableTextBlock,
	"unit-ref": EmbeddedPortableTextBlock,
	"unit-list": EmbeddedPortableTextBlock,
	media: EmbeddedPortableTextBlock,
	divider: EmbeddedPortableTextBlock,
	columns: EmbeddedPortableTextBlock,
	group: EmbeddedPortableTextBlock,
	callout: EmbeddedPortableTextBlock,
	tabs: EmbeddedPortableTextBlock,
};

function WikiPortableText({
	language,
	value,
}: {
	readonly language: ZoneRenderProjection["zone"]["language"];
	readonly value: unknown;
}) {
	return (
		<LocalizedPortableTextContent
			language={language}
			types={portableTextBlockTypes}
			value={normalizePortableText(value)}
			variant="article"
		/>
	);
}

export function ZoneWikiPostContent({
	language,
	value,
}: {
	readonly language: ZoneRenderProjection["zone"]["language"];
	readonly value: unknown;
}) {
	return <WikiPortableText language={language} value={value} />;
}

function ZoneBlocks({ blocks }: { blocks: readonly Block[] }) {
	return (
		<>
			{blocks.map((block) => (
				<ZoneBlock block={block} key={block._key} />
			))}
		</>
	);
}

function SearchResults({
	results,
	presentation,
	total,
	unitListLayout,
}: {
	results: readonly SearchResult[];
	presentation: Pick<SearchPresentation, "results" | "showResultCount">;
	total: number;
	unitListLayout?: UnitListLayout;
}) {
	const context = useZoneBlocks();
	const { t } = useTranslation("zones");
	const { t: search } = useTranslation("search");
	if (results.length === 0)
		return <p className="mt-4 text-muted-foreground text-sm">{t.searchEmpty}</p>;
	return (
		<div className="mt-4 grid gap-3">
			{presentation.showResultCount ? (
				<p className="text-muted-foreground text-sm">
					{search.resultCount({ count: total })}
				</p>
			) : null}
			<ul
				aria-label={t.searchResults}
				className={cn(
					"grid gap-2",
					presentation.results === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
					unitListLayout === "carousel" &&
						"grid-flow-col auto-cols-[minmax(16rem,22rem)] overflow-x-auto pb-3 sm:grid-cols-none lg:grid-cols-none",
				)}
			>
				{results.map((result) => {
					const href =
						result.category === "posts" || result.category === "reviews"
							? postHref(result.id, {
									kind: "zone",
									zone: context.projection.zone,
								})
							: unitIdHref(result.kind, result.id);
					const title = result.title ?? result.name ?? t.untitledResult;
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
						<li key={`${result.kind}:${result.id}`}>
							{href ? <AppLink href={href}>{content}</AppLink> : content}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function ZoneSearchFeature({
	blockKey,
	feature,
	onExecute,
	pending,
	error,
	facets,
	results,
	presentation,
	total = 0,
	autoExecute = false,
	unitListLayout,
	initialPageSize,
	appearance = "page",
	surface,
	initialValues = [],
	renderToolbarFilters,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	onExecute: (request: SearchFeatureRequest) => void;
	pending: boolean;
	error: boolean;
	facets?: readonly SearchFacet[];
	results?: readonly SearchResult[];
	presentation: Pick<SearchPresentation, "results" | "showResultCount">;
	total?: number;
	autoExecute?: boolean;
	unitListLayout?: UnitListLayout;
	initialPageSize?: number;
	appearance?: "feed" | "page";
	surface: SearchFeatureSurface;
	initialValues?: readonly SearchControlValue[];
	renderToolbarFilters?: (template: SearchTemplateId) => ReactNode;
}) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const template = useGetApiSearchFeaturesByTemplate(
		{ path: { template: feature.kind === "template" ? feature.template : "global" } },
		{ query: { enabled: feature.kind === "template" } },
	);
	const zone = useGetApiSearchZonesByZoneIdFeature(
		{ path: { zoneId: context.projection.zone.id } },
		{ query: { enabled: feature.kind === "zone" } },
	);
	const rawDefinition = feature.kind === "template" ? template.data : zone.data?.definition;
	const initialState = useMemo<SearchFeatureRequest["state"] | undefined>(() => {
		if (!rawDefinition) return undefined;
		const expression =
			initialValues.length === 0
				? undefined
				: initialValues.length === 1
					? initialValues[0]
					: { operator: "all" as const, clauses: [...initialValues] };
		return {
			...(expression ? { expression } : {}),
			...(initialPageSize ? { pageSize: initialPageSize } : {}),
		};
	}, [initialPageSize, initialValues, rawDefinition]);
	const autoExecuted = useRef(false);
	useEffect(() => {
		if (!autoExecute || !initialState || autoExecuted.current) return;
		autoExecuted.current = true;
		onExecute({
			injections: [],
			state: initialState,
		});
	}, [autoExecute, initialState, onExecute]);
	if (feature.kind === "template" ? template.isError : zone.isError)
		return <p className="my-4 text-destructive text-sm">{t.searchFailed}</p>;
	if ((feature.kind === "template" ? template.isPending : zone.isPending) || !rawDefinition)
		return null;
	const definition = parseSearchFeatureDefinition(rawDefinition);
	return (
		<SearchFeature
			appearance={appearance}
			definition={definition}
			error={error}
			facets={facets}
			id={`zone-search-${blockKey}`}
			initialState={initialState}
			onExecute={onExecute}
			pending={pending}
			resolveLabel={(unitId) => context.units.get(unitId)?.title ?? undefined}
			resolveOptionLabel={(_control, value) =>
				typeof value === "string"
					? (context.units.get(value)?.title ?? undefined)
					: undefined
			}
			surface={surface}
			toolbarFilters={renderToolbarFilters?.(definition.document.template.id)}
		>
			{results ? (
				<SearchResults
					presentation={presentation}
					results={results}
					total={total}
					unitListLayout={unitListLayout}
				/>
			) : null}
		</SearchFeature>
	);
}

interface SearchExecutionResponse {
	readonly nextCursor?: string;
	readonly facets?: readonly SearchFacet[];
	readonly groups: readonly {
		readonly hits: readonly SearchResult[];
		readonly total: { readonly value: string | number };
	}[];
}

function toSearchPage(value: SearchExecutionResponse): SearchPage {
	return {
		facets: value.facets,
		results: value.groups.flatMap((group) => group.hits),
		nextCursor: value.nextCursor,
		total: value.groups.reduce((total, group) => total + Number(group.total.value), 0),
	};
}

function toZoneFeedPage(value: ZoneFeedExecutionResponse): ZoneFeedPage {
	return {
		facets: value.facets,
		items: value.items,
		nextCursor: value.nextCursor,
		total: Number(value.total),
	};
}

function appendZoneFeedPage(current: ZoneFeedPage | undefined, next: ZoneFeedPage): ZoneFeedPage {
	if (!current) return next;
	const items = new Map(current.items.map((item) => [item.id, item]));
	for (const item of next.items) items.set(item.id, item);
	return {
		facets: next.facets ?? current.facets,
		items: [...items.values()],
		nextCursor: next.nextCursor,
		total: Math.max(current.total, next.total),
	};
}

function requestWithCursor(request: ZoneFeedRequest, cursor: string): ZoneFeedRequest {
	return { ...request, state: { ...request.state, cursor } };
}

function requestWithoutCursor(request: ZoneFeedRequest): ZoneFeedRequest {
	const { cursor: _cursor, ...state } = request.state;
	return { ...request, state };
}

function withContentKindFilter(
	request: ZoneFeedRequest,
	contentKinds: readonly SimpleFeedContentKind[],
): ZoneFeedRequest {
	const contentFilter = createSimpleFeedFilter({ contentKinds });
	const filter = mergeUnitFilter(request.state.filter, contentFilter);
	return {
		...request,
		state: {
			...request.state,
			...(filter ? { filter } : {}),
		},
	};
}

function ZoneFeedBlock({
	blockKey,
	execute,
	feature,
	pending,
	error,
	presentation,
	maxResults,
}: {
	blockKey: string;
	execute: (request: ZoneFeedRequest) => Promise<ZoneFeedExecutionResponse>;
	feature: SearchFeatureSource;
	pending: boolean;
	error: boolean;
	presentation: FeedPresentation;
	maxResults?: number;
}) {
	const context = useZoneBlocks();
	const { t } = useTranslation(["actions", "feed", "state"]);
	const [request, setRequest] = useState<ZoneFeedRequest>();
	const [contentKinds, setContentKinds] = useState<readonly SimpleFeedContentKind[]>([]);
	const [page, setPage] = useState<ZoneFeedPage>();
	const executionSequence = useRef(0);
	const run = (
		nextRequest: ZoneFeedRequest,
		nextContentKinds: readonly SimpleFeedContentKind[],
		append: boolean,
	) => {
		const sequence = ++executionSequence.current;
		if (!append) {
			setRequest(nextRequest);
			setPage(undefined);
		}
		void execute(withContentKindFilter(nextRequest, nextContentKinds)).then(
			(result) => {
				if (sequence !== executionSequence.current) return;
				setPage((current) =>
					append
						? appendZoneFeedPage(current, toZoneFeedPage(result))
						: toZoneFeedPage(result),
				);
			},
			() => undefined,
		);
	};
	const loadMore = () => {
		if (!request || !page?.nextCursor || pending) return;
		run(requestWithCursor(request, page.nextCursor), contentKinds, true);
	};
	const selectContentKinds = (nextContentKinds: readonly SimpleFeedContentKind[]) => {
		setContentKinds(nextContentKinds);
		if (!request) return;
		run(requestWithoutCursor(request), nextContentKinds, false);
	};
	const canLoadMore = Boolean(
		page?.nextCursor && (!maxResults || page.items.length < maxResults),
	);
	const continuationState: FeedContinuationState = !canLoadMore
		? { status: "exhausted" }
		: pending
			? { status: "loading" }
			: error
				? { status: "error", retry: loadMore }
				: { status: "ready", loadNext: loadMore };
	return (
		<>
			<ZoneSearchFeature
				appearance="feed"
				autoExecute
				blockKey={blockKey}
				error={error}
				facets={page?.facets}
				feature={feature}
				initialPageSize={maxResults && maxResults <= 20 ? maxResults : undefined}
				onExecute={(nextRequest) => run(nextRequest, contentKinds, false)}
				pending={pending}
				presentation={{ results: "list", showResultCount: presentation.showResultCount }}
				surface="feed"
				total={page?.total}
				renderToolbarFilters={(template) => {
					const options = workZoneFeedContentKinds(template);
					return options ? (
						<FeedContentSelector
							onValueChange={selectContentKinds}
							options={options}
							value={contentKinds}
						/>
					) : null;
				}}
			/>
			<FeedList
				aria-label={t.feed.title}
				continuation={{
					mode: presentation.pagination,
					state: continuationState,
				}}
				emptyBody={t.feed.emptyBody}
				emptyTitle={t.feed.emptyTitle}
				errorLabel={t.state.error}
				getItemKey={(item) => item.id}
				renderItem={(item, metadata) => (
					<FeedItemCard
						item={item}
						postContext={{ kind: "zone", zone: context.projection.zone }}
						position={metadata.position}
						setSize={metadata.setSize}
					/>
				)}
				retryLabel={t.actions.retry}
				state={
					!page && pending
						? { status: "pending" }
						: !page && error
							? {
									status: "error",
									retry: () => request && run(request, contentKinds, false),
								}
							: {
									status: "ready",
									items: maxResults
										? (page?.items.slice(0, maxResults) ?? [])
										: (page?.items ?? []),
								}
				}
			/>
		</>
	);
}

function DockFeedBlock({
	blockKey,
	feature,
	presentation,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	presentation: FeedPresentation;
}) {
	const context = useZoneBlocks();
	const localizationLanguages = useLocalizationLanguages();
	const mutation = usePostApiSearchZonesByZoneIdFeedBlocksByBlockKeyExecute();
	return (
		<ZoneFeedBlock
			blockKey={blockKey}
			error={mutation.isError}
			execute={(body) =>
				mutation.mutateAsync({
					body: {
						...body,
						localizationLanguages,
						surface: { kind: "dock" },
					},
					path: { blockKey, zoneId: context.projection.zone.id },
				})
			}
			feature={feature}
			pending={mutation.isPending}
			presentation={presentation}
		/>
	);
}

function PageFeedBlock({
	blockKey,
	feature,
	pageId,
	presentation,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	pageId: string;
	presentation: FeedPresentation;
}) {
	const context = useZoneBlocks();
	const localizationLanguages = useLocalizationLanguages();
	const mutation = usePostApiSearchZonesByZoneIdFeedBlocksByBlockKeyExecute();
	return (
		<ZoneFeedBlock
			blockKey={blockKey}
			error={mutation.isError}
			execute={(body) =>
				mutation.mutateAsync({
					body: {
						...body,
						localizationLanguages,
						surface: { kind: "page", pageId },
					},
					path: { blockKey, zoneId: context.projection.zone.id },
				})
			}
			feature={feature}
			pending={mutation.isPending}
			presentation={presentation}
		/>
	);
}

type UnitListBlock = Extract<Block, { readonly _type: "unit-list" }>;
type UnitListLayout = UnitListBlock["layout"];

function unitListClasses(layout: UnitListLayout): string {
	return cn(
		"my-6 grid gap-4",
		layout === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
		layout === "carousel" &&
			"grid-flow-col auto-cols-[minmax(16rem,22rem)] overflow-x-auto pb-3",
	);
}

function CollectionUnitList({
	collectionId,
	layout,
	limit,
}: {
	collectionId: string;
	layout: UnitListLayout;
	limit: number;
}) {
	const context = useZoneBlocks();
	const { t } = useTranslation("zones");
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsByCollectionIdItems({
		path: { collectionId },
		query: { limit, localizationLanguages },
	});
	if (query.isPending) return null;
	if (query.isError) return <p className="my-4 text-destructive text-sm">{t.searchFailed}</p>;
	const items = query.data?.items ?? [];
	if (items.length === 0)
		return <p className="my-4 text-muted-foreground text-sm">{t.searchEmpty}</p>;
	return (
		<ul aria-label={t.contentList} className={unitListClasses(layout)}>
			{items.map((item) => (
				<li key={item.membership.targetId}>
					<FeedItemCard
						item={item.content}
						postContext={{ kind: "zone", zone: context.projection.zone }}
					/>
				</li>
			))}
		</ul>
	);
}

function ZoneSearchUnitListBlock({
	blockKey,
	error,
	execute,
	feature,
	layout,
	limit,
	pending,
	presentation,
}: {
	readonly blockKey: string;
	readonly error: boolean;
	readonly execute: (request: SearchFeatureRequest) => Promise<SearchExecutionResponse>;
	readonly feature: SearchFeatureSource;
	readonly layout: UnitListLayout;
	readonly limit: number;
	readonly pending: boolean;
	readonly presentation: SearchPresentation;
}) {
	const [page, setPage] = useState<SearchPage>();
	return (
		<ZoneSearchFeature
			autoExecute
			blockKey={blockKey}
			error={error}
			facets={page?.facets}
			feature={feature}
			initialPageSize={Math.min(limit, 50)}
			onExecute={(request) => {
				void execute(request).then(
					(response) => setPage(toSearchPage(response)),
					() => undefined,
				);
			}}
			pending={pending}
			presentation={presentation}
			results={page?.results.slice(0, limit)}
			surface="search"
			total={page?.total}
			unitListLayout={layout}
		/>
	);
}

function SearchUnitList({
	blockKey,
	feature,
	layout,
	limit,
	pageId,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	layout: UnitListLayout;
	limit: number;
	pageId?: string;
}) {
	const context = useZoneBlocks();
	const localizationLanguages = useLocalizationLanguages();
	const dockMutation = usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute();
	const pageMutation = usePostApiSearchZonesByZoneIdPagesByPageIdBlocksByBlockKeyExecute();
	const presentation = {
		results: layout === "grid" || layout === "carousel" ? "grid" : "list",
		pagination: "load-more",
		showResultCount: false,
	} as const;
	if (pageId === undefined)
		return (
			<ZoneSearchUnitListBlock
				blockKey={blockKey}
				error={dockMutation.isError}
				execute={(body) =>
					dockMutation.mutateAsync({
						body: { ...body, localizationLanguages },
						path: { blockKey, zoneId: context.projection.zone.id },
					})
				}
				feature={feature}
				layout={layout}
				limit={limit}
				pending={dockMutation.isPending}
				presentation={presentation}
			/>
		);
	return (
		<ZoneSearchUnitListBlock
			blockKey={blockKey}
			error={pageMutation.isError}
			execute={(body) =>
				pageMutation.mutateAsync({
					body: { ...body, localizationLanguages },
					path: { blockKey, pageId, zoneId: context.projection.zone.id },
				})
			}
			feature={feature}
			layout={layout}
			limit={limit}
			pending={pageMutation.isPending}
			presentation={presentation}
		/>
	);
}

function RenderUnitTitle({ unit }: { readonly unit: RenderUnit | undefined }) {
	return unit?.title ? <LocalizedText language={unit.language} value={unit.title} /> : null;
}

function ZoneMediaBlock({ block }: { readonly block: Extract<Block, { _type: "media" }> }) {
	const context = useZoneBlocks();
	const asset = context.assets.get(block.assetId);
	const altUnit = context.units.get(block.altUnitId);
	const captionUnit = block.captionUnitId ? context.units.get(block.captionUnitId) : undefined;
	const alt = useChineseContentText(altUnit?.title ?? "", altUnit?.language);
	if (!asset) return null;
	const image = (
		<figure className="my-6 overflow-hidden rounded-xl border border-border-weak">
			<img
				alt={alt}
				className={cn(
					"h-auto w-full",
					block.fit === "cover" && "max-h-[36rem] object-cover",
				)}
				src={asset.url}
			/>
			{captionUnit ? (
				<figcaption className="px-4 py-3 text-muted-foreground text-sm">
					<RenderUnitTitle unit={captionUnit} />
				</figcaption>
			) : null}
		</figure>
	);
	if (!block.target) return image;
	const href = navigationHref(block.target, context);
	return href ? <AppLink href={href}>{image}</AppLink> : image;
}

function ZoneBlock({ block }: { block: Block }) {
	const { t } = useTranslation(["ui", "zones"]);
	const context = useZoneBlocks();
	const surface = useContext(ZoneBlockSurfaceContext);
	if (block._type === "portable-text")
		return (
			<WikiPortableText language={context.projection.zone.language} value={block.content} />
		);
	if (block._type === "post-full-view") {
		const wikiPost = context.projection.references.wikiPosts.find(
			(candidate) => candidate.id === block.postId,
		);
		if (!wikiPost) return null;
		return (
			<article>
				<header className="mb-8 border-b border-border-weak pb-6">
					<h1 className="font-serif font-bold text-3xl tracking-tight sm:text-4xl">
						<LocalizedText
							language={wikiPost.language}
							value={wikiPost.title ?? t.ui.unnamed}
						/>
					</h1>
					{wikiPost.summary ? (
						<p className="mt-3 max-w-3xl text-muted-foreground leading-7">
							<LocalizedText language={wikiPost.language} value={wikiPost.summary} />
						</p>
					) : null}
				</header>
				<WikiPortableText language={wikiPost.language} value={wikiPost.body.content} />
			</article>
		);
	}
	if (block._type === "columns") {
		const style = {
			"--zone-columns": block.columns.map(({ weight }) => `minmax(0, ${weight}fr)`).join(" "),
		} as CSSProperties;
		return (
			<div
				className="my-6 grid grid-cols-1 items-start gap-5 md:[grid-template-columns:var(--zone-columns)]"
				style={style}
			>
				{block.columns.map((column) => (
					<div className="min-w-0" key={column._key}>
						<ZoneBlocks blocks={column.blocks} />
					</div>
				))}
			</div>
		);
	}
	if (block._type === "unit-ref") {
		const referenced = context.units.get(block.unitId);
		return referenced ? (
			<ReferencedUnit appearance={block.appearance} unit={referenced} />
		) : null;
	}
	if (block._type === "unit-list") {
		if (block.source.kind === "collection")
			return (
				<CollectionUnitList
					collectionId={block.source.collectionId}
					layout={block.layout}
					limit={block.limit}
				/>
			);
		if (block.source.kind === "search") {
			if (!surface) return null;
			return (
				<SearchUnitList
					blockKey={block._key}
					feature={block.source.feature}
					layout={block.layout}
					limit={block.limit}
					pageId={surface.kind === "page" ? surface.pageId : undefined}
				/>
			);
		}
		const units = block.source.unitIds
			.map((id) => context.units.get(id))
			.filter((unit): unit is RenderUnit => Boolean(unit))
			.slice(0, block.limit);
		return (
			<div aria-label={t.zones.contentList} className={unitListClasses(block.layout)}>
				{units.map((unit) => (
					<ReferencedUnit appearance="card" key={unit.id} unit={unit} />
				))}
			</div>
		);
	}
	if (block._type === "feed") {
		if (!surface) return null;
		return surface.kind === "dock" ? (
			<DockFeedBlock
				blockKey={block._key}
				feature={block.feature}
				presentation={block.presentation}
			/>
		) : (
			<PageFeedBlock
				blockKey={block._key}
				feature={block.feature}
				pageId={surface.pageId}
				presentation={block.presentation}
			/>
		);
	}
	if (block._type === "menu") return <ZoneNavigationMenu navigationId={block.navigationId} />;
	if (block._type === "media") return <ZoneMediaBlock block={block} />;
	if (block._type === "divider")
		return block.style === "space" ? (
			<div aria-hidden className="h-8" />
		) : (
			<Separator
				className={cn("my-8 bg-border-weak", block.style === "section" && "h-0.5")}
			/>
		);
	if (block._type === "group")
		return (
			<div
				className={cn(
					"my-5 gap-4",
					block.layout === "stack" && "grid",
					block.layout === "row" && "flex flex-wrap items-start",
					block.layout === "grid" && "grid sm:grid-cols-2 lg:grid-cols-3",
				)}
			>
				<ZoneBlocks blocks={block.blocks} />
			</div>
		);
	if (block._type === "callout")
		return (
			<aside
				className={cn(
					"my-6 rounded-xl border-s-4 bg-muted/45 p-5",
					block.tone === "info" && "border-s-info",
					block.tone === "success" && "border-s-success",
					block.tone === "warning" && "border-s-warning",
					block.tone === "danger" && "border-s-destructive",
				)}
			>
				{block.labelUnitId ? (
					<h2 className="mb-3 font-semibold">
						<RenderUnitTitle unit={context.units.get(block.labelUnitId)} />
					</h2>
				) : null}
				<ZoneBlocks blocks={block.blocks} />
			</aside>
		);
	if (block._type === "tabs") {
		const first = block.tabs[0];
		if (!first) return null;
		return (
			<Tabs className="my-6" defaultValue={first._key}>
				<TabsList className="max-w-full overflow-x-auto" variant="underline">
					{block.tabs.map((tab) => (
						<TabsTrigger key={tab._key} value={tab._key}>
							<RenderUnitTitle unit={context.units.get(tab.labelUnitId)} />
						</TabsTrigger>
					))}
				</TabsList>
				{block.tabs.map((tab) => (
					<TabsContent key={tab._key} value={tab._key}>
						<ZoneBlocks blocks={tab.blocks} />
					</TabsContent>
				))}
			</Tabs>
		);
	}
	return null;
}

export function ZoneBlockProvider({
	baseHref,
	children,
	projection,
}: {
	baseHref: string;
	children: ReactNode;
	projection: ZoneRenderProjection;
}) {
	const value = useMemo<ZoneBlockContextValue>(
		() => ({
			baseHref,
			projection,
			units: new Map(projection.references.units.map((unit) => [unit.id, unit])),
			assets: new Map(projection.references.assets.map((asset) => [asset.id, asset])),
			navigations: new Map(
				projection.navigations.map((navigation) => [navigation.id, navigation]),
			),
		}),
		[baseHref, projection],
	);
	return <ZoneBlockContext value={value}>{children}</ZoneBlockContext>;
}

export function ZoneDocument({
	blocks,
	navigationLayout = "horizontal",
	surface,
}: {
	blocks: readonly Block[];
	navigationLayout?: ZoneNavigationLayout;
	surface: ZoneBlockSurface;
}) {
	return (
		<ZoneBlockSurfaceContext value={surface}>
			<ZoneNavigationLayoutContext value={navigationLayout}>
				<ZoneBlocks blocks={blocks} />
			</ZoneNavigationLayoutContext>
		</ZoneBlockSurfaceContext>
	);
}
