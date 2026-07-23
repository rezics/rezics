"use client";

import {
	Block as BlockContract,
	isDocument,
	type Block,
	type NavigationItem,
	type NavigationTarget,
	type SearchFeatureSource,
} from "@rezics/block";
import { parseSearchFeatureDefinition } from "@rezics/search";
import {
	useGetApiSearchFeaturesByTemplate,
	useGetApiSearchZonesByZoneIdFeature,
	usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute,
	usePostApiSearchZonesByZoneIdPagesBySlugBlocksByBlockKeyExecute,
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
	PortableTextContent,
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

import { AppLink } from "@/features/application-shell/components/app-link";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";
import { useTranslation } from "@/i18n/client";
import type { ZoneRenderNavigation, ZoneRenderProjection } from "../model/zone-render";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];
type RenderAsset = ZoneRenderProjection["references"]["assets"][number];
type ZoneBlockSurface =
	{ readonly kind: "dock" } | { readonly kind: "page"; readonly slug: string };
type ZoneNavigationLayout = "horizontal" | "vertical";
type NavigationLeafItem = Extract<NavigationItem, { target: unknown }>;
type NavigationGroupItem = Extract<NavigationItem, { children: unknown }>;
type SearchResult = {
	readonly id: string;
	readonly category: string;
	readonly kind: string;
	readonly titles: readonly string[];
	readonly name?: string | null;
	readonly summary?: string | null;
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

function unitHref(unit: RenderUnit): string | null {
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
	if (targetUnit?.kind === "zone_page" && targetUnit.zonePageSlug)
		return targetUnit.zonePageSlug === "home"
			? context.baseHref
			: `${context.baseHref}/${targetUnit.zonePageSlug}`;
	return targetUnit ? unitHref(targetUnit) : null;
}

function ReferencedUnit({ unit, appearance }: { unit: RenderUnit; appearance: string }) {
	const href = unitHref(unit);
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
					fallback={unit.title?.slice(0, 1) ?? ""}
				/>
			) : null}
			<div className="min-w-0">
				<p className="truncate font-semibold">{unit.title}</p>
				{appearance !== "inline" && unit.summary ? (
					<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
						{unit.summary}
					</p>
				) : null}
			</div>
		</div>
	);
	return href ? <AppLink href={href}>{content}</AppLink> : content;
}

const RootMenuPositioning = { placement: "bottom-start", gutter: 4 } as const;
const NestedMenuPositioning = { placement: "right-start", gutter: -2 } as const;
const MenuHoverCloseDelay = 180;

function navigationLabel(item: NavigationItem, context: ZoneBlockContextValue): string | null {
	return context.units.get(item.labelUnitId)?.title ?? null;
}

function NavigationLeaf({ item }: { item: NavigationLeafItem }) {
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const label = navigationLabel(item, context);
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
	const label = navigationLabel(item, context);
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
	const label = navigationLabel(item, context);
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
	const label = navigationLabel(item, context);
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

function WikiPortableText({ value }: { value: unknown }) {
	return <PortableTextContent types={portableTextBlockTypes} value={value} variant="article" />;
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

function SearchResults({ results }: { results: readonly SearchResult[] }) {
	const { t } = useTranslation("zones");
	if (results.length === 0)
		return <p className="mt-4 text-muted-foreground text-sm">{t.searchEmpty}</p>;
	return (
		<ul aria-label={t.searchResults} className="mt-4 grid gap-2">
			{results.map((result) => {
				const href = unitIdHref(result.kind, result.id);
				const title = result.titles[0] ?? result.name ?? t.untitledResult;
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
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	onExecute: (request: SearchFeatureRequest) => void;
	pending: boolean;
	error: boolean;
	facets?: readonly {
		controlKey?: string;
		field: string;
		options: readonly { value: string }[];
	}[];
	results?: readonly SearchResult[];
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
	if (feature.kind === "template" ? template.isError : zone.isError)
		return <p className="my-4 text-destructive text-sm">{t.searchFailed}</p>;
	if ((feature.kind === "template" ? template.isPending : zone.isPending) || !rawDefinition)
		return null;
	const definition = parseSearchFeatureDefinition(rawDefinition);
	return (
		<SearchFeature
			definition={definition}
			error={error}
			facets={facets}
			id={`zone-search-${blockKey}`}
			onExecute={onExecute}
			pending={pending}
			resolveLabel={(unitId) => context.units.get(unitId)?.title ?? undefined}
			resolveOptionLabel={(_control, value) =>
				typeof value === "string"
					? (context.units.get(value)?.title ?? undefined)
					: undefined
			}
		>
			{results ? <SearchResults results={results} /> : null}
		</SearchFeature>
	);
}

function DockSearchBlock({
	blockKey,
	feature,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
}) {
	const context = useZoneBlocks();
	const mutation = usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute();
	return (
		<ZoneSearchFeature
			blockKey={blockKey}
			feature={feature}
			error={mutation.isError}
			facets={mutation.data?.facets}
			onExecute={(body) =>
				mutation.mutate({
					body,
					path: { blockKey, zoneId: context.projection.zone.id },
				})
			}
			pending={mutation.isPending}
			results={mutation.data?.groups.flatMap((group) => group.hits)}
		/>
	);
}

function PageSearchBlock({
	blockKey,
	feature,
	slug,
}: {
	blockKey: string;
	feature: SearchFeatureSource;
	slug: string;
}) {
	const context = useZoneBlocks();
	const mutation = usePostApiSearchZonesByZoneIdPagesBySlugBlocksByBlockKeyExecute();
	return (
		<ZoneSearchFeature
			blockKey={blockKey}
			feature={feature}
			error={mutation.isError}
			facets={mutation.data?.facets}
			onExecute={(body) =>
				mutation.mutate({
					body,
					path: { blockKey, slug, zoneId: context.projection.zone.id },
				})
			}
			pending={mutation.isPending}
			results={mutation.data?.groups.flatMap((group) => group.hits)}
		/>
	);
}

function ZoneBlock({ block }: { block: Block }) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const surface = useContext(ZoneBlockSurfaceContext);
	if (block._type === "portable-text") return <WikiPortableText value={block.content} />;
	if (block._type === "post-full-view") {
		const wikiPost = context.projection.references.wikiPosts.find(
			(candidate) => candidate.id === block.postId,
		);
		if (!wikiPost) return null;
		return (
			<article className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
				<header className="mb-8 border-b border-border-weak pb-6">
					<h1 className="font-serif font-bold text-3xl tracking-tight sm:text-4xl">
						{wikiPost.title}
					</h1>
					{wikiPost.summary ? (
						<p className="mt-3 max-w-3xl text-muted-foreground leading-7">
							{wikiPost.summary}
						</p>
					) : null}
				</header>
				<WikiPortableText value={wikiPost.body.content} />
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
		if (block.source.kind !== "units") return null;
		const units = block.source.unitIds
			.map((id) => context.units.get(id))
			.filter((unit): unit is RenderUnit => Boolean(unit))
			.slice(0, block.limit);
		return (
			<div
				aria-label={t.contentList}
				className={cn(
					"my-6 grid gap-4",
					block.layout === "grid" && "sm:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{units.map((unit) => (
					<ReferencedUnit appearance="card" key={unit.id} unit={unit} />
				))}
			</div>
		);
	}
	if (block._type === "search" || block._type === "feed") {
		if (!surface) return null;
		return surface.kind === "dock" ? (
			<DockSearchBlock blockKey={block._key} feature={block.feature} />
		) : (
			<PageSearchBlock blockKey={block._key} feature={block.feature} slug={surface.slug} />
		);
	}
	if (block._type === "menu") return <ZoneNavigationMenu navigationId={block.navigationId} />;
	if (block._type === "media") {
		const asset = context.assets.get(block.assetId);
		const alt = context.units.get(block.altUnitId)?.title ?? "";
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
				{block.captionUnitId ? (
					<figcaption className="px-4 py-3 text-muted-foreground text-sm">
						{context.units.get(block.captionUnitId)?.title}
					</figcaption>
				) : null}
			</figure>
		);
		if (!block.target) return image;
		const href = navigationHref(block.target, context);
		return href ? <AppLink href={href}>{image}</AppLink> : image;
	}
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
						{context.units.get(block.labelUnitId)?.title}
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
							{context.units.get(tab.labelUnitId)?.title}
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
