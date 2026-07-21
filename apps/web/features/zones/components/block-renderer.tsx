"use client";

import {
	Block as BlockContract,
	isDocument,
	type Block,
	type NavigationItem,
	type NavigationTarget,
} from "@rezics/block";
import {
	usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute,
	usePostApiSearchZonesByZoneIdPagesBySlugBlocksByBlockKeyExecute,
} from "@rezics/openapi-tanstack-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Button,
	Input,
	PortableTextContent,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Spinner,
	cn,
} from "@rezics/ui";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import {
	createContext,
	useContext,
	useMemo,
	useState,
	type CSSProperties,
	type FormEvent,
	type ReactNode,
} from "react";

import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import type { ZoneRenderNavigation, ZoneRenderProjection } from "../model/zone-render";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];
type RenderAsset = ZoneRenderProjection["references"]["assets"][number];
type ZoneBlockSurface =
	{ readonly kind: "dock" } | { readonly kind: "page"; readonly slug: string };
type ZoneNavigationLayout = "horizontal" | "vertical";
type SearchResult = {
	readonly id: string;
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
	if (target.kind === "zone-page")
		return target.slug === "home" ? context.baseHref : `${context.baseHref}/${target.slug}`;
	const targetUnit = context.units.get(target.unitId);
	return targetUnit ? unitHref(targetUnit) : null;
}

function ReferencedUnit({ unit, appearance }: { unit: RenderUnit; appearance: string }) {
	const href = unitHref(unit);
	const image = appearance === "cover" ? unit.cover : unit.avatar;
	const content = (
		<div
			className={cn(
				"flex min-w-0 items-center gap-3",
				appearance !== "inline" && "rounded-xl border border-border-weak bg-card p-4",
			)}
		>
			{image ? (
				<Avatar className={appearance === "cover" ? "size-16 rounded-lg" : "size-10"}>
					<AvatarImage alt="" src={image.url} />
					<AvatarFallback>{unit.title?.slice(0, 1) ?? ""}</AvatarFallback>
				</Avatar>
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

function NavigationLeaf({ item }: { item: Extract<NavigationItem, { target: unknown }> }) {
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const label = context.units.get(item.labelUnitId)?.title;
	const href = navigationHref(item.target, context);
	if (!label || !href) return null;
	const external = item.target.kind === "external";
	return (
		<AppLink
			className={cn(
				"inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
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

function NavigationNode({ item }: { item: NavigationItem }) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	if ("target" in item) return <NavigationLeaf item={item} />;
	const label = context.units.get(item.labelUnitId)?.title;
	if (!label) return null;
	return (
		<Popover modal={false} positioning={{ placement: "bottom-start", gutter: 4 }}>
			<PopoverTrigger
				aria-label={t.openMenu({ label })}
				className={cn(
					"flex min-h-10 cursor-pointer items-center gap-1 rounded-lg px-3 font-medium text-sm hover:bg-accent",
					layout === "vertical" && "w-full justify-between",
				)}
			>
				{label}
				<ChevronDown aria-hidden className="size-3.5" />
			</PopoverTrigger>
			<PopoverContent className="grid min-w-52 gap-1 p-2">
				{item.children.map((child) => (
					<NavigationNode item={child} key={child._key} />
				))}
			</PopoverContent>
		</Popover>
	);
}

export function ZoneNavigationMenu({ navigationId }: { navigationId: string }) {
	const { t } = useTranslation("zones");
	const context = useZoneBlocks();
	const layout = useContext(ZoneNavigationLayoutContext);
	const navigation = context.navigations.get(navigationId);
	if (!navigation) return null;
	return (
		<nav
			aria-label={t.navigation}
			className={cn("min-w-0 gap-1", layout === "horizontal" ? "flex items-center" : "grid")}
		>
			{navigation.document.items.map((item) => (
				<NavigationNode item={item} key={item._key} />
			))}
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

function SearchBlockForm({
	blockKey,
	error,
	onSearch,
	pending,
	results,
}: {
	blockKey: string;
	error: boolean;
	onSearch: (query: string) => void;
	pending: boolean;
	results?: readonly SearchResult[];
}) {
	const { t } = useTranslation("zones");
	const [query, setQuery] = useState("");
	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSearch(query);
	}
	return (
		<form className="my-6 rounded-xl border border-border-weak bg-card p-4" onSubmit={submit}>
			<label className="font-semibold text-sm" htmlFor={`zone-search-${blockKey}`}>
				{t.searchTitle}
			</label>
			<div className="mt-3 flex gap-2">
				<Input
					id={`zone-search-${blockKey}`}
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder={t.searchPlaceholder}
					type="search"
					value={query}
				/>
				<Button disabled={pending} type="submit" variant="solid">
					{pending ? <Spinner aria-hidden /> : <Search aria-hidden />}
					{t.searchSubmit}
				</Button>
			</div>
			{error ? <p className="mt-3 text-destructive text-sm">{t.searchFailed}</p> : null}
			{results ? <SearchResults results={results} /> : null}
		</form>
	);
}

function DockSearchBlock({ blockKey }: { blockKey: string }) {
	const context = useZoneBlocks();
	const mutation = usePostApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute();
	return (
		<SearchBlockForm
			blockKey={blockKey}
			error={mutation.isError}
			onSearch={(query) =>
				mutation.mutate({
					body: { filters: [], mode: "basic", query },
					path: { blockKey, zoneId: context.projection.zone.id },
				})
			}
			pending={mutation.isPending}
			results={mutation.data?.groups.flatMap((group) => group.hits)}
		/>
	);
}

function PageSearchBlock({ blockKey, slug }: { blockKey: string; slug: string }) {
	const context = useZoneBlocks();
	const mutation = usePostApiSearchZonesByZoneIdPagesBySlugBlocksByBlockKeyExecute();
	return (
		<SearchBlockForm
			blockKey={blockKey}
			error={mutation.isError}
			onSearch={(query) =>
				mutation.mutate({
					body: { filters: [], mode: "basic", query },
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
	if (block._type === "search") {
		if (!surface) return null;
		return surface.kind === "dock" ? (
			<DockSearchBlock blockKey={block._key} />
		) : (
			<PageSearchBlock blockKey={block._key} slug={surface.slug} />
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
			<hr
				className={cn("my-8 border-border-weak", block.style === "section" && "border-t-2")}
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
