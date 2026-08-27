"use client";

import {
	Block as BlockContract,
	appendBlockPath,
	isDocument,
	type Block,
	type BlockPath,
	type BlockPathSegment,
	type NavigationItem,
	type NavigationTarget,
	type SearchFeatureSource,
} from "@rezics/block";
import {
	createSimpleFeedFilter,
	mergeUnitFilter,
	parseSearchFeatureDefinition,
	type FilterDocument,
	type SearchControlValue,
	type SearchSort,
	type SimpleFeedContentKind,
} from "@rezics/filter";
import {
	postApiSearchZonesByZoneIdDockFeedBlockExecutions,
	postApiSearchZonesByZoneIdPagesByPageIdFeedBlockExecutions,
	postApiSearchFilterDefinition,
	useGetApiSearchZonesByZoneIdFilter,
	type PostApiSearchZonesByZoneIdDockFeedBlockExecutionsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useMutation, useQuery } from "@tanstack/react-query";
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
	Component,
	createContext,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { normalizePortableText } from "@rezics/portable-text";

import { AppLink } from "@/features/application-shell/components/app-link";
import { BlockContractRoot } from "@/features/block-composition/block-contract-root";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { FeedItemCard, type FeedItem } from "@/features/content-feed/components/feed-item-card";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import {
	LocalizedText,
	useChineseContentText,
} from "@/features/content-language-display/chinese-content-display-context";
import { FeedContentSelector } from "@/features/content-feed/components/feed-content-selector";
import { FeedList } from "@/features/content-feed/components/feed-list";
import type { FeedContinuationState } from "@/features/content-feed/model/feed-continuation";
import type { SearchFeedContinuationToken } from "@/features/content-feed/model/search-feed-continuation-token";
import { postHref } from "@/features/posts/url";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";
import { zonePageHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { getNextItemPageParam } from "@/lib/infinite-query";
import { workZoneFeedContentKinds } from "../model/work-zone-feed";
import { useZoneThemeScopeStyle } from "./zone-theme-content";
import type { ZoneRenderNavigation, ZoneRenderProjection } from "../model/zone-render";
import type {
	ZoneAggregateFeedItemResult,
	ZoneAggregateSelectedUnit,
	ZoneAggregateSortAdvisory,
} from "../model/zone-page-aggregate";
import { zoneSearchEntryHref } from "../model/zone-search-entry";
import {
	ZoneUnitListBlock,
	type ZoneUnitListRenderUnit,
	type ZoneUnitListSearchFacet,
	type ZoneUnitListSearchFeatureProps,
	type ZoneUnitListSurface,
} from "./unit-list-block";
import { useZoneAggregateBlockState, useZoneAggregateStatus } from "./zone-page-aggregate-provider";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];
type RenderAsset = ZoneRenderProjection["references"]["assets"][number];
type ZoneBlockSurface = ZoneUnitListSurface;
type ZoneNavigationLayout = "horizontal" | "vertical";
type NavigationLeafItem = Extract<NavigationItem, { target: unknown }>;
type NavigationGroupItem = Extract<NavigationItem, { children: unknown }>;
type FeedPresentation = Extract<Block, { readonly _type: "feed" }>["presentation"];
type SearchFacet = ZoneUnitListSearchFacet;
type SearchCountResult = {
	readonly value: number;
	readonly kind: "exact" | "lower-bound";
};
type ZoneFeedExecutionResponse = PostApiSearchZonesByZoneIdDockFeedBlockExecutionsStatus200 & {
	readonly advisory?: ZoneAggregateSortAdvisory;
	readonly hidden?: boolean;
	readonly selected?: ZoneAggregateSelectedUnit;
	readonly selectionSeed?: string;
};
type ZoneFeedRequest = SearchFeatureRequest;
type ZoneFeedPage = {
	readonly advisory?: ZoneAggregateSortAdvisory;
	readonly facets?: readonly SearchFacet[];
	readonly items: readonly FeedItem[];
	readonly nextCursor?: SearchFeedContinuationToken;
	readonly selectionSeed?: string;
	readonly total: SearchCountResult;
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
	if (unit.kind === "zone_page" && context)
		return zonePageHref(context.projection.zone, {
			id: unit.id,
			slug: unit.zonePageSlug,
		});
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
	const href = unitHref(unit, context);
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
			data-part="card"
		>
			{avatar ? (
				<IdentityAvatar
					avatar={avatar}
					className={appearance === "cover" ? "size-16 rounded-lg" : "size-10"}
					data-part="cover"
					fallback={title.slice(0, 1)}
				/>
			) : null}
			<div className="min-w-0">
				<p className="truncate font-semibold" data-part="title">
					{title}
				</p>
				{appearance !== "inline" && summary ? (
					<p className="mt-1 line-clamp-2 text-muted-foreground text-sm" data-part="summary">
						{summary}
					</p>
				) : null}
			</div>
		</div>
	);
	return href ? (
		<AppLink data-part="link" href={href}>
			{content}
		</AppLink>
	) : (
		content
	);
}

function ReferencedUnitCard({ unit }: { readonly unit: ZoneUnitListRenderUnit }) {
	return <ReferencedUnit appearance="card" unit={unit} />;
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
			data-part="link"
			href={href}
			rel={external ? "noopener noreferrer" : undefined}
			target={external ? "_blank" : undefined}
		>
			<span data-part="label">{label}</span>
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
				data-part="link"
				href={href}
				rel={external ? "noopener noreferrer" : undefined}
				target={external ? "_blank" : undefined}
			>
				<span data-part="label">{label}</span>
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
			<MenuSubTrigger data-part="label">{label}</MenuSubTrigger>
			<MenuSubContent
				className="min-w-52"
				onPointerEnter={hoverBoundary.onPointerEnter}
				onPointerLeave={hoverBoundary.onPointerLeave}
			>
				{item.children.map((child) => (
					<NavigationMenuNode hoverBoundary={hoverBoundary} item={child} key={child._key} />
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
				data-part="label"
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
					<NavigationMenuNode hoverBoundary={hoverBoundary} item={child} key={child._key} />
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
			data-part="list"
		>
			{navigation.document.items.map((item) => {
				if ("target" in item)
					return (
						<div data-part="item" key={item._key}>
							<NavigationLeaf item={item} />
						</div>
					);
				const hoverBoundary = {
					onPointerEnter: () => openGroup(item._key),
					onPointerLeave: scheduleClose,
				};
				return (
					<div data-part="item" key={item._key}>
						<NavigationDropdown
							hoverBoundary={hoverBoundary}
							item={item}
							onOpenChange={(open) => {
								cancelScheduledClose();
								setOpenGroupKey((current) =>
									open ? item._key : current === item._key ? null : current,
								);
							}}
							open={openGroupKey === item._key}
						/>
					</div>
				);
			})}
		</nav>
	);
}

function EmbeddedPortableTextBlock({ value }: { value: unknown }) {
	if (!isDocument(BlockContract, value)) return null;
	return <IsolatedZoneBlock block={value} path={[{ slot: "blocks", key: value._key }]} />;
}

const portableTextBlockTypes = {
	"portable-text": EmbeddedPortableTextBlock,
	"unit-ref": EmbeddedPortableTextBlock,
	"unit-list": EmbeddedPortableTextBlock,
	"url-image": EmbeddedPortableTextBlock,
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

function ZoneBlocks({
	blocks,
	parentPath = [],
}: {
	readonly blocks: readonly Block[];
	readonly parentPath?: readonly BlockPathSegment[];
}) {
	return (
		<>
			{blocks.map((block) => {
				const path = appendBlockPath(parentPath, "blocks", block._key);
				return <IsolatedZoneBlock block={block} key={block._key} path={path} />;
			})}
		</>
	);
}

function IsolatedZoneBlock({ block, path }: { readonly block: Block; readonly path: BlockPath }) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const aggregateStatus = useZoneAggregateStatus();
	const resetKey = `${context.projection.page?.latestUnitRevisionId ?? "no-page"}:${aggregateStatus}`;
	return (
		<BlockContractRoot block={block}>
			<ZoneBlockErrorBoundary
				fallback={
					<p className="my-4 text-destructive text-sm" data-part="error">
						{t.searchFailed}
					</p>
				}
				resetKey={resetKey}
			>
				<ZoneBlock block={block} path={path} />
			</ZoneBlockErrorBoundary>
		</BlockContractRoot>
	);
}

class ZoneBlockErrorBoundary extends Component<
	{ readonly children: ReactNode; readonly fallback: ReactNode; readonly resetKey: string },
	{ readonly failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidUpdate(previous: Readonly<{ readonly resetKey: string }>) {
		if (this.state.failed && previous.resetKey !== this.props.resetKey)
			this.setState({ failed: false });
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

function ZoneSearchFeature({
	children,
	feature,
	onExecute,
	pending,
	error,
	facets,
	autoExecute = false,
	initialPageSize,
	initialSort,
	appearance = "page",
	surface,
	initialValues = [],
	showSortControl = true,
	renderToolbarFilters,
	contract,
}: ZoneUnitListSearchFeatureProps & {
	appearance?: "feed" | "page";
	initialSort?: SearchSort;
	initialValues?: readonly SearchControlValue[];
	renderToolbarFilters?: (filterDocument: FilterDocument) => ReactNode;
	contract?: "feed" | "search";
}) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const searchId = useId();
	const embeddedFilterDocument =
		feature.kind === "global"
			? ({} satisfies FilterDocument)
			: feature.kind === "inline"
				? feature.filterDocument
				: undefined;
	const embedded = useQuery({
		queryKey: ["zone-block-filter-definition", embeddedFilterDocument],
		enabled: embeddedFilterDocument !== undefined,
		queryFn: async () => {
			if (!embeddedFilterDocument) throw new Error("Filter document is unavailable");
			return (await postApiSearchFilterDefinition({ body: embeddedFilterDocument })).data;
		},
	});
	const zone = useGetApiSearchZonesByZoneIdFilter(
		{ path: { zoneId: context.projection.zone.id } },
		{ query: { enabled: feature.kind === "zone" } },
	);
	const rawDefinition = feature.kind === "zone" ? zone.data : embedded.data;
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
			...(initialSort ? { sort: initialSort } : {}),
		};
	}, [initialPageSize, initialSort, initialValues, rawDefinition]);
	const autoExecuted = useRef(false);
	const automaticState = useMemo(() => {
		if (!initialState || !initialSort) return initialState;
		const { sort: _persistedInitialSort, ...state } = initialState;
		return state;
	}, [initialSort, initialState]);
	useEffect(() => {
		if (!autoExecute || !automaticState || autoExecuted.current) return;
		autoExecuted.current = true;
		onExecute({
			injections: [],
			state: automaticState,
		});
	}, [autoExecute, automaticState, onExecute]);
	if (feature.kind === "zone" ? zone.isError : embedded.isError)
		return (
			<p className="my-4 text-destructive text-sm" data-part={contract ? "error" : undefined}>
				{t.searchFailed}
			</p>
		);
	if ((feature.kind === "zone" ? zone.isPending : embedded.isPending) || !rawDefinition)
		return <div aria-busy="true" data-part={contract ? "loading" : undefined} />;
	const definition = parseSearchFeatureDefinition(rawDefinition);
	return (
		<SearchFeature
			appearance={appearance}
			definition={definition}
			error={error}
			facets={facets}
			id={`zone-search-${searchId}`}
			initialState={initialState}
			onExecute={onExecute}
			pending={pending}
			parts={
				contract === "search"
					? { filters: "filters", form: "form", query: "query", submit: "submit" }
					: contract === "feed"
						? { toolbar: "toolbar" }
						: undefined
			}
			resolveLabel={(unitId) => context.units.get(unitId)?.title ?? undefined}
			resolveOptionLabel={(_control, value) =>
				typeof value === "string" ? (context.units.get(value)?.title ?? undefined) : undefined
			}
			showSortControl={showSortControl}
			surface={surface}
			toolbarFilters={renderToolbarFilters?.(definition.filterDocument)}
		>
			{children}
		</SearchFeature>
	);
}

function ZoneSearchBlock({ block }: { readonly block: Extract<Block, { _type: "search" }> }) {
	const context = useZoneBlocks();
	const router = useApplicationRouter();
	return (
		<section className="my-6">
			<ZoneSearchFeature
				contract="search"
				error={false}
				feature={block.feature}
				onExecute={(request) => router.push(zoneSearchEntryHref(context.baseHref, request))}
				pending={false}
				surface="search"
			/>
		</section>
	);
}

function toZoneFeedPage(
	value: ZoneFeedExecutionResponse,
	currentCursor?: SearchFeedContinuationToken,
): ZoneFeedPage {
	const nextCursor = getNextItemPageParam(value, [], currentCursor);
	return {
		...(value.advisory ? { advisory: value.advisory } : {}),
		facets: value.facets,
		items: value.items,
		// The successful Feed endpoint response is the proof for this route-specific brand.
		nextCursor: nextCursor as SearchFeedContinuationToken | undefined,
		...(value.selectionSeed ? { selectionSeed: value.selectionSeed } : {}),
		total: {
			kind: value.total.kind,
			value: Number(value.total.value),
		},
	};
}

function toAggregateFeedPage(result: ZoneAggregateFeedItemResult): ZoneFeedPage {
	return {
		...(result.advisory ? { advisory: result.advisory } : {}),
		facets: result.facets,
		items: result.items,
		nextCursor: result.nextCursor as SearchFeedContinuationToken | undefined,
		...(result.selectionSeed ? { selectionSeed: result.selectionSeed } : {}),
		total: result.total ?? { kind: "exact", value: result.items.length },
	};
}

function appendZoneFeedPage(current: ZoneFeedPage | undefined, next: ZoneFeedPage): ZoneFeedPage {
	if (!current) return next;
	const items = new Map(current.items.map((item) => [item.id, item]));
	for (const item of next.items) items.set(item.id, item);
	return {
		advisory: next.advisory ?? current.advisory,
		facets: next.facets?.length ? next.facets : current.facets,
		items: [...items.values()],
		nextCursor: next.nextCursor,
		selectionSeed: next.selectionSeed ?? current.selectionSeed,
		total: current.total,
	};
}

function requestWithCursor(
	request: ZoneFeedRequest,
	cursor: SearchFeedContinuationToken,
): ZoneFeedRequest {
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
	blockPath,
	execute,
	feature,
	pending,
	error,
	initialSort,
	presentation,
	surface,
	maxResults,
}: {
	blockPath: BlockPath;
	execute: (
		request: ZoneFeedRequest,
		signal: AbortSignal,
		selectionSeed?: string,
	) => Promise<ZoneFeedExecutionResponse>;
	feature: SearchFeatureSource;
	pending: boolean;
	error: boolean;
	initialSort?: SearchSort;
	presentation: FeedPresentation;
	surface: ZoneBlockSurface;
	maxResults?: number;
}) {
	const context = useZoneBlocks();
	const { t } = useTranslation(["actions", "feed", "state"]);
	const aggregate = useZoneAggregateBlockState(surface.kind, blockPath);
	const [request, setRequest] = useState<ZoneFeedRequest>();
	const [contentKinds, setContentKinds] = useState<readonly SimpleFeedContentKind[]>([]);
	const [page, setPage] = useState<ZoneFeedPage>();
	const aggregatePage =
		aggregate.kind === "ok" && aggregate.blockType === "feed" && aggregate.itemKind === "feed-item"
			? toAggregateFeedPage(aggregate)
			: undefined;
	const aggregateContractError =
		aggregate.kind === "ok" &&
		(aggregate.blockType !== "feed" || aggregate.itemKind !== "feed-item");
	const aggregatePending = aggregate.kind === "pending";
	const aggregateError = aggregate.kind === "error" || aggregateContractError;
	const displayedPage = page ?? aggregatePage;
	const effectiveInitialSort =
		request?.state.sort ?? displayedPage?.advisory?.resolvedSort ?? initialSort;
	const aggregateRequest = useMemo<ZoneFeedRequest>(
		() => ({
			injections: [],
			state: {
				...(maxResults && maxResults <= 20 ? { pageSize: maxResults } : {}),
				...(effectiveInitialSort ? { sort: effectiveInitialSort } : {}),
			},
		}),
		[effectiveInitialSort, maxResults],
	);
	const effectiveRequest =
		request ?? (aggregatePage || aggregateError ? aggregateRequest : undefined);
	const effectivePending = pending || aggregatePending;
	const effectiveError = error || aggregateError;
	const executionSequence = useRef(0);
	const executionController = useRef<AbortController | undefined>(undefined);
	useEffect(() => () => executionController.current?.abort(), []);
	if (aggregate.kind === "hidden") return null;
	const run = (
		nextRequest: ZoneFeedRequest,
		nextContentKinds: readonly SimpleFeedContentKind[],
		append: boolean,
	) => {
		const sequence = ++executionSequence.current;
		executionController.current?.abort();
		const controller = new AbortController();
		executionController.current = controller;
		if (!append) {
			setRequest(nextRequest);
			setPage(undefined);
		}
		void execute(
			withContentKindFilter(nextRequest, nextContentKinds),
			controller.signal,
			displayedPage?.selectionSeed,
		).then(
			(result) => {
				if (sequence !== executionSequence.current) return;
				const nextPage = toZoneFeedPage(
					result,
					nextRequest.state.cursor as SearchFeedContinuationToken | undefined,
				);
				setPage((current) =>
					append ? appendZoneFeedPage(current ?? aggregatePage, nextPage) : nextPage,
				);
			},
			() => undefined,
		);
	};
	const loadMore = () => {
		if (!effectiveRequest || !displayedPage?.nextCursor || effectivePending) return;
		run(requestWithCursor(effectiveRequest, displayedPage.nextCursor), contentKinds, true);
	};
	const selectContentKinds = (nextContentKinds: readonly SimpleFeedContentKind[]) => {
		setContentKinds(nextContentKinds);
		if (!effectiveRequest) return;
		run(requestWithoutCursor(effectiveRequest), nextContentKinds, false);
	};
	const canLoadMore = Boolean(
		displayedPage?.nextCursor && (!maxResults || displayedPage.items.length < maxResults),
	);
	const continuationState: FeedContinuationState = !canLoadMore
		? { status: "exhausted" }
		: effectivePending
			? { status: "loading" }
			: effectiveError
				? { status: "error", retry: loadMore }
				: { status: "ready", loadNext: loadMore };
	return (
		<>
			<ZoneSearchFeature
				appearance="feed"
				autoExecute={
					request === undefined &&
					(aggregate.kind === "legacy" ||
						(aggregate.kind === "skipped" && aggregate.reason === "inactive-tab"))
				}
				contract="feed"
				error={effectiveError}
				facets={displayedPage?.facets}
				feature={feature}
				initialPageSize={maxResults && maxResults <= 20 ? maxResults : undefined}
				initialSort={effectiveInitialSort}
				key={effectiveInitialSort ?? "default"}
				onExecute={(nextRequest) => run(nextRequest, contentKinds, false)}
				pending={effectivePending}
				surface="feed"
				renderToolbarFilters={(filterDocument) => {
					const options = workZoneFeedContentKinds(filterDocument);
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
				continuation={{ mode: presentation.pagination, state: continuationState }}
				emptyBody={t.feed.emptyBody}
				emptyTitle={t.feed.emptyTitle}
				errorLabel={t.state.error}
				getItemKey={(item) => item.id}
				parts={{
					continuation: "continuation",
					empty: "empty",
					error: "error",
					item: "item",
					items: "items",
					loading: "loading",
				}}
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
					!displayedPage && effectivePending
						? { status: "pending" }
						: !displayedPage && effectiveError
							? {
									status: "error",
									retry: () => effectiveRequest && run(effectiveRequest, contentKinds, false),
								}
							: {
									status: "ready",
									items: maxResults
										? (displayedPage?.items.slice(0, maxResults) ?? [])
										: (displayedPage?.items ?? []),
								}
				}
			/>
		</>
	);
}

function useZoneFeedBlockExecution(blockPath: BlockPath, surface: ZoneBlockSurface) {
	const context = useZoneBlocks();
	const localizationLanguages = useLocalizationLanguages();
	return useMutation({
		mutationFn: async ({
			request,
			selectionSeed,
			signal,
		}: {
			request: ZoneFeedRequest;
			selectionSeed?: string;
			signal: AbortSignal;
		}) => {
			const input = {
				body: {
					state: request.state,
					...(selectionSeed ? { selectionSeed } : {}),
					localizationLanguages,
					path: [...blockPath],
				},
				signal,
			};
			const { data } =
				surface.kind === "dock"
					? await postApiSearchZonesByZoneIdDockFeedBlockExecutions({
							...input,
							path: { zoneId: context.projection.zone.id },
						})
					: await postApiSearchZonesByZoneIdPagesByPageIdFeedBlockExecutions({
							...input,
							path: { pageId: surface.pageId, zoneId: context.projection.zone.id },
						});
			return data;
		},
	});
}

function DockFeedBlock({
	blockPath,
	feature,
	initialSort,
	presentation,
}: {
	blockPath: BlockPath;
	feature: SearchFeatureSource;
	initialSort?: SearchSort;
	presentation: FeedPresentation;
}) {
	const surface = { kind: "dock" } as const;
	const mutation = useZoneFeedBlockExecution(blockPath, surface);
	return (
		<ZoneFeedBlock
			blockPath={blockPath}
			error={mutation.isError}
			execute={(request, signal, selectionSeed) =>
				mutation.mutateAsync({ request, selectionSeed, signal })
			}
			feature={feature}
			initialSort={initialSort}
			pending={mutation.isPending}
			presentation={presentation}
			surface={surface}
		/>
	);
}

function PageFeedBlock({
	blockPath,
	feature,
	initialSort,
	pageId,
	presentation,
}: {
	blockPath: BlockPath;
	feature: SearchFeatureSource;
	initialSort?: SearchSort;
	pageId: string;
	presentation: FeedPresentation;
}) {
	const surface = { kind: "page", pageId } as const;
	const mutation = useZoneFeedBlockExecution(blockPath, surface);
	return (
		<ZoneFeedBlock
			blockPath={blockPath}
			error={mutation.isError}
			execute={(request, signal, selectionSeed) =>
				mutation.mutateAsync({ request, selectionSeed, signal })
			}
			feature={feature}
			initialSort={initialSort}
			pending={mutation.isPending}
			presentation={presentation}
			surface={surface}
		/>
	);
}

function RenderUnitTitle({ unit }: { readonly unit: RenderUnit | undefined }) {
	return unit?.title ? <LocalizedText language={unit.language} value={unit.title} /> : null;
}

function ZoneImageBlock({
	block,
}: {
	readonly block: Extract<Block, { _type: "image" | "url-image" }>;
}) {
	const context = useZoneBlocks();
	const language = context.projection.zone.language;
	const alt = useChineseContentText(block.alt ?? "", language);
	const caption = useChineseContentText(block.caption ?? "", language);
	const src = block._type === "image" ? context.assets.get(block.assetId)?.url : block.url;
	if (!src) return null;
	return (
		<figure
			className="my-6 overflow-hidden rounded-xl border border-border-weak"
			data-part="figure"
		>
			<img alt={alt} className="h-auto w-full" data-part="asset" src={src} />
			{caption ? (
				<figcaption className="px-4 py-3 text-muted-foreground text-sm" data-part="caption">
					{caption}
				</figcaption>
			) : null}
		</figure>
	);
}

function ZoneBlock({ block, path }: { block: Block; path: BlockPath }) {
	const { t } = useTranslation(["ui", "zones"]);
	const context = useZoneBlocks();
	const surface = useContext(ZoneBlockSurfaceContext);
	if (block._type === "portable-text")
		return (
			<div data-part="content">
				<WikiPortableText language={context.projection.zone.language} value={block.content} />
			</div>
		);
	if (block._type === "post-full-view") {
		const wikiPost = context.projection.references.wikiPosts.find(
			(candidate) => candidate.id === block.postId,
		);
		if (!wikiPost) return null;
		return (
			<article data-part="content">
				<header className="mb-8 border-b border-border-weak pb-6" data-part="header">
					<h1
						className="font-serif font-bold text-3xl tracking-tight sm:text-4xl"
						data-part="title"
					>
						<LocalizedText language={wikiPost.language} value={wikiPost.title ?? t.ui.unnamed} />
					</h1>
					{wikiPost.summary ? (
						<p className="mt-3 max-w-3xl text-muted-foreground leading-7" data-part="summary">
							<LocalizedText language={wikiPost.language} value={wikiPost.summary} />
						</p>
					) : null}
				</header>
				<div data-part="content">
					<WikiPortableText language={wikiPost.language} value={wikiPost.body.content} />
				</div>
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
					<div className="min-w-0" data-part="column" key={column._key}>
						<ZoneBlocks
							blocks={column.blocks}
							parentPath={appendBlockPath(path, "columns", column._key)}
						/>
					</div>
				))}
			</div>
		);
	}
	if (block._type === "unit-ref") {
		const referenced = context.units.get(block.unitId);
		return referenced ? <ReferencedUnit appearance={block.appearance} unit={referenced} /> : null;
	}
	if (block._type === "unit-list") {
		return (
			<ZoneUnitListBlock
				ReferencedUnitComponent={ReferencedUnitCard}
				SearchFeatureComponent={ZoneSearchFeature}
				block={block}
				blockPath={path}
				resolveNavigationHref={(target) => navigationHref(target, context)}
				resolveSearchResultHref={(result) => unitIdHref(result.kind, result.id)}
				resolveUnitHref={(unit) => unitHref(unit, context)}
				surface={surface}
				units={context.units}
				zone={context.projection.zone}
			/>
		);
	}
	if (block._type === "search") return <ZoneSearchBlock block={block} />;
	if (block._type === "feed") {
		if (!surface) return null;
		const feature = block.feature.kind === "derived" ? block.feature.query.feature : block.feature;
		const initialSort =
			block.feature.kind === "derived"
				? (block.feature.query.sort ?? block.initialSort)
				: block.initialSort;
		return surface.kind === "dock" ? (
			<DockFeedBlock
				blockPath={path}
				feature={feature}
				initialSort={initialSort}
				presentation={block.presentation}
			/>
		) : (
			<PageFeedBlock
				blockPath={path}
				feature={feature}
				initialSort={initialSort}
				pageId={surface.pageId}
				presentation={block.presentation}
			/>
		);
	}
	if (block._type === "menu") return <ZoneNavigationMenu navigationId={block.navigationId} />;
	if (block._type === "image" || block._type === "url-image")
		return <ZoneImageBlock block={block} />;
	if (block._type === "divider")
		return block.style === "space" ? (
			<div aria-hidden className="h-8" data-part="separator" />
		) : (
			<Separator
				className={cn("my-8 bg-border-weak", block.style === "section" && "h-0.5")}
				data-part="separator"
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
				data-part="content"
			>
				<ZoneBlocks blocks={block.blocks} parentPath={path} />
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
					<h2 className="mb-3 font-semibold" data-part="title">
						<RenderUnitTitle unit={context.units.get(block.labelUnitId)} />
					</h2>
				) : null}
				<div data-part="content">
					<ZoneBlocks blocks={block.blocks} parentPath={path} />
				</div>
			</aside>
		);
	if (block._type === "tabs") {
		const first = block.tabs[0];
		if (!first) return null;
		return (
			<Tabs className="my-6" defaultValue={first._key}>
				<TabsList className="max-w-full overflow-x-auto" data-part="list" variant="underline">
					{block.tabs.map((tab) => (
						<TabsTrigger data-part="tab" key={tab._key} value={tab._key}>
							<RenderUnitTitle unit={context.units.get(tab.labelUnitId)} />
						</TabsTrigger>
					))}
				</TabsList>
				{block.tabs.map((tab) => (
					<TabsContent data-part="panel" key={tab._key} value={tab._key}>
						<ZoneBlocks blocks={tab.blocks} parentPath={appendBlockPath(path, "tabs", tab._key)} />
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
			navigations: new Map(projection.navigations.map((navigation) => [navigation.id, navigation])),
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
	const themeStyle = useZoneThemeScopeStyle();
	return (
		<div
			className="min-w-0"
			data-zone-theme-scope=""
			style={{ ...themeStyle, contain: "paint", isolation: "isolate" }}
		>
			<div data-zone-surface={surface.kind}>
				<ZoneBlockSurfaceContext value={surface}>
					<ZoneNavigationLayoutContext value={navigationLayout}>
						<ZoneBlocks blocks={blocks} />
					</ZoneNavigationLayoutContext>
				</ZoneBlockSurfaceContext>
			</div>
		</div>
	);
}
