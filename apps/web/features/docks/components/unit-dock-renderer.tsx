"use client";

import {
	DockDocument,
	NavigationDocument,
	collectBlockReferences,
	parseDocument,
	type NavigationDocument as NavigationDocumentValue,
	type NavigationItem,
	type NavigationTarget,
	type UnitListPresentation,
	type UnitReferencedBlock,
} from "@rezics/block";
import {
	type PostApiUnitsPresentationsStatus200,
	type GetApiRealmsByRealmIdWikiNavigationStatus200,
	postApiUnitsPresentations,
	useGetApiCollectionsByCollectionIdItems,
	useGetApiRealmsByRealmIdWikiNavigation,
	useGetApiUnitsByIdByUnitIdDocksByKind,
} from "@rezics/openapi-tanstack-query";
import {
	Card,
	CardContent,
	IdentityAvatar,
	QueryFailure,
	Separator,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	UnitCard,
	cn,
} from "@rezics/ui";
import { Shelf } from "@rezics/ui/custom/shelf";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

import { AppLink } from "@/features/application-shell/components/app-link";
import { BlockContractRoot } from "@/features/block-composition/block-contract-root";
import { IdentityBadgeLink } from "@/features/block-composition/components/identity-badge-link";
import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedItemIdentityBadge } from "@/features/content-feed/components/feed-item-identity-badge";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { partitionDockPresentationIds, type DockTarget } from "../model/dock";

type UnitPresentation = PostApiUnitsPresentationsStatus200["items"][number];
type Navigation = {
	readonly id: string;
	readonly document: NavigationDocumentValue;
};

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" && error !== null && "status" in error && error.status === status
	);
}

function collectNavigationUnitIds(items: readonly NavigationItem[]): string[] {
	return items.flatMap((item) => [
		item.labelUnitId,
		...("target" in item && item.target.kind === "unit" ? [item.target.unitId] : []),
		...("children" in item ? collectNavigationUnitIds(item.children) : []),
	]);
}

function parseNavigations(
	items: GetApiRealmsByRealmIdWikiNavigationStatus200 | undefined,
): Navigation[] {
	if (!items) return [];
	return items.items.flatMap((navigation) => {
		try {
			return [
				{
					id: navigation.id,
					document: parseDocument(NavigationDocument, navigation.document),
				},
			];
		} catch {
			return [];
		}
	});
}

export function UnitDockRenderer({
	className,
	ownerUnitId,
	target,
}: {
	readonly className?: string;
	readonly ownerUnitId: string;
	readonly target: DockTarget;
}) {
	const { t } = useTranslation(["docks"]);
	const localizationLanguages = useLocalizationLanguages();
	const dock = useGetApiUnitsByIdByUnitIdDocksByKind({
		path: { unitId: ownerUnitId, kind: target.dockKind },
	});
	const document = useMemo(() => {
		if (!dock.data) return null;
		try {
			return parseDocument(DockDocument, dock.data.document);
		} catch {
			return null;
		}
	}, [dock.data]);
	const references = useMemo(
		() => (document ? collectBlockReferences(document) : null),
		[document],
	);
	const navigation = useGetApiRealmsByRealmIdWikiNavigation(
		{ path: { realmId: ownerUnitId } },
		{
			query: {
				enabled: target.ownerKind === "realm" && Boolean(references?.navigationIds.size),
			},
		},
	);
	const navigations = useMemo(() => parseNavigations(navigation.data), [navigation.data]);
	const presentationIds = useMemo(
		() =>
			[
				...(references?.unitIds ?? []),
				...navigations.flatMap((item) => collectNavigationUnitIds(item.document.items)),
			].filter((id, index, ids) => ids.indexOf(id) === index),
		[navigations, references],
	);
	const presentationBatches = useMemo(
		() => partitionDockPresentationIds(presentationIds),
		[presentationIds],
	);
	const presentations = useQuery({
		queryKey: ["unit-dock-presentations", localizationLanguages, ...presentationIds],
		queryFn: async ({ signal }) => {
			const responses = await Promise.all(
				presentationBatches.map(async (ids) => {
					const { data } = await postApiUnitsPresentations({
						body: { ids: [...ids], localizationLanguages },
						signal,
						throwOnError: true,
					});
					return data;
				}),
			);
			return responses.flatMap((response) => response.items);
		},
		enabled: presentationBatches.length > 0,
	});

	if (dock.isPending) return null;
	if (dock.isError && hasStatus(dock.error, 404)) return null;
	if (dock.isError) return <QueryFailure error={dock.error} retry={() => void dock.refetch()} />;
	if (!document || document.blocks.length === 0) return null;
	const units = new Map(
		(presentations.data ?? []).map((presentation) => [presentation.id, presentation]),
	);
	const navigationMap = new Map(navigations.map((item) => [item.id, item]));
	return (
		<section
			aria-label={t.docks.kinds[target.dockKind].label}
			className={cn("grid gap-4", className)}
		>
			<DockBlocks blocks={document.blocks} navigations={navigationMap} units={units} />
			<RequestFailure error={presentations.error ?? navigation.error} />
		</section>
	);
}

function DockBlocks({
	blocks,
	navigations,
	units,
}: {
	readonly blocks: readonly UnitReferencedBlock[];
	readonly navigations: ReadonlyMap<string, Navigation>;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}) {
	return blocks.map((block) => (
		<DockBlock block={block} key={block._key} navigations={navigations} units={units} />
	));
}

function DockBlock({
	block,
	navigations,
	units,
}: {
	readonly block: UnitReferencedBlock;
	readonly navigations: ReadonlyMap<string, Navigation>;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}): ReactNode {
	return (
		<BlockContractRoot block={block}>
			<DockBlockContent block={block} navigations={navigations} units={units} />
		</BlockContractRoot>
	);
}

function DockBlockContent({
	block,
	navigations,
	units,
}: {
	readonly block: UnitReferencedBlock;
	readonly navigations: ReadonlyMap<string, Navigation>;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}): ReactNode {
	const { t } = useTranslation(["ui"]);
	if (block._type === "unit-ref") {
		const unit = units.get(block.unitId);
		return unit ? <DockUnit appearance={block.appearance} unit={unit} /> : null;
	}
	if (block._type === "unit-list") {
		if (block.source.kind === "collection")
			return (
				<DockCollection
					collectionId={block.source.collectionId}
					layout={block.layout}
					limit={block.limit}
					presentation={block.presentation}
					units={units}
				/>
			);
		if (block.source.kind !== "units") return null;
		const items = block.source.unitIds
			.map((id) => units.get(id))
			.filter((unit): unit is UnitPresentation => Boolean(unit))
			.slice(0, block.limit);
		const itemHeadingAs =
			block.presentation?.headingUnitId && units.get(block.presentation.headingUnitId)?.title
				? "h3"
				: "h2";
		return (
			<DockUnitList layout={block.layout} presentation={block.presentation} units={units}>
				{block.presentation?.itemAppearance === "identity-badge"
					? items.map((unit) => (
							<li data-part="item" key={unit.id}>
								<DockUnitIdentityBadge unit={unit} />
							</li>
						))
					: items.map((unit) => (
							<div data-part="item" key={unit.id}>
								<DockUnitCard headingAs={itemHeadingAs} unit={unit} />
							</div>
						))}
			</DockUnitList>
		);
	}
	if (block._type === "menu") {
		const navigation = navigations.get(block.navigationId);
		return navigation ? (
			<DockNavigation
				appearance={block.appearance}
				document={navigation.document}
				orientation={block.orientation}
				units={units}
			/>
		) : null;
	}
	if (block._type === "image" || block._type === "url-image") {
		const src =
			block._type === "image"
				? `/image-assets/${encodeURIComponent(block.assetId)}/content`
				: block.url;
		return (
			<figure className="overflow-hidden rounded-xl border border-border-weak" data-part="figure">
				<img alt={block.alt ?? ""} className="h-auto w-full" data-part="asset" src={src} />
				{block.caption ? (
					<figcaption className="px-4 py-3 text-muted-foreground text-sm" data-part="caption">
						{block.caption}
					</figcaption>
				) : null}
			</figure>
		);
	}
	if (block._type === "divider")
		return block.style === "space" ? (
			<div aria-hidden className="h-6" data-part="separator" />
		) : (
			<Separator
				className={cn("my-3 bg-border-weak", block.style === "section" && "h-0.5")}
				data-part="separator"
			/>
		);
	if (block._type === "columns") {
		const style: CSSProperties & { "--dock-columns": string } = {
			"--dock-columns": block.columns.map(({ weight }) => `minmax(0, ${weight}fr)`).join(" "),
		};
		return (
			<div
				className="grid grid-cols-1 items-start gap-4 md:[grid-template-columns:var(--dock-columns)]"
				style={style}
			>
				{block.columns.map((column) => (
					<div className="min-w-0" data-part="column" key={column._key}>
						<DockBlocks blocks={column.blocks} navigations={navigations} units={units} />
					</div>
				))}
			</div>
		);
	}
	if (block._type === "group")
		return (
			<div
				className={cn(
					"gap-4",
					block.layout === "stack" && "grid",
					block.layout === "row" && "flex flex-wrap items-start",
					block.layout === "grid" && "grid sm:grid-cols-2",
				)}
				data-part="content"
			>
				<DockBlocks blocks={block.blocks} navigations={navigations} units={units} />
			</div>
		);
	if (block._type === "callout")
		return (
			<Card
				appearance="outlined"
				className={cn(
					"border-s-4",
					block.tone === "info" && "border-s-info",
					block.tone === "success" && "border-s-success",
					block.tone === "warning" && "border-s-warning",
					block.tone === "danger" && "border-s-destructive",
				)}
			>
				<CardContent className="grid gap-3 p-4" data-part="content">
					{block.labelUnitId ? (
						<strong data-part="title">{units.get(block.labelUnitId)?.title ?? t.ui.unnamed}</strong>
					) : null}
					<DockBlocks blocks={block.blocks} navigations={navigations} units={units} />
				</CardContent>
			</Card>
		);
	if (block._type === "tabs") {
		const visibleTabs = block.tabs.filter((tab) => units.has(tab.labelUnitId));
		const first = visibleTabs[0];
		if (!first) return null;
		return (
			<Tabs defaultValue={first._key}>
				<TabsList className="max-w-full overflow-x-auto" data-part="list" variant="underline">
					{visibleTabs.map((tab) => (
						<TabsTrigger data-part="tab" key={tab._key} value={tab._key}>
							{units.get(tab.labelUnitId)?.title ?? t.ui.unnamed}
						</TabsTrigger>
					))}
				</TabsList>
				{visibleTabs.map((tab) => (
					<TabsContent className="pt-3" data-part="panel" key={tab._key} value={tab._key}>
						<DockBlocks blocks={tab.blocks} navigations={navigations} units={units} />
					</TabsContent>
				))}
			</Tabs>
		);
	}
	return null;
}

function DockUnit({
	appearance,
	unit,
}: {
	readonly appearance: "inline" | "card" | "cover";
	readonly unit: UnitPresentation;
}) {
	const { t } = useTranslation(["ui"]);
	const title = unit.title ?? t.ui.unnamed;
	const href = publicUnitHref(unit.kind, unit);
	const content =
		appearance === "inline" ? (
			<span className="font-medium" data-part="title">
				{title}
			</span>
		) : (
			<Card appearance="outlined" data-part="card">
				<CardContent className="flex min-w-0 items-center gap-3 p-4">
					<IdentityAvatar
						avatar={unit.avatar}
						className={appearance === "cover" ? "size-16 rounded-lg" : "size-10"}
						data-part="cover"
						fallback={title.slice(0, 1)}
					/>
					<p className="min-w-0 truncate font-semibold" data-part="title">
						{title}
					</p>
				</CardContent>
			</Card>
		);
	return href ? (
		<AppLink data-part="link" href={href}>
			{content}
		</AppLink>
	) : (
		content
	);
}

function DockUnitCard({
	headingAs,
	unit,
}: {
	readonly headingAs: "h2" | "h3";
	readonly unit: UnitPresentation;
}) {
	const { t } = useTranslation(["ui"]);
	const title = unit.title ?? t.ui.unnamed;
	const href = publicUnitHref(unit.kind, unit);
	if (!href) return <DockUnit appearance="card" unit={unit} />;
	return (
		<UnitCard
			fallback={
				<IdentityAvatar
					avatar={unit.avatar}
					className="size-full rounded-xl"
					fallback={title.slice(0, 1)}
				/>
			}
			headingAs={headingAs}
			href={href}
			title={title}
		/>
	);
}

function DockUnitIdentityBadge({ unit }: { readonly unit: UnitPresentation }) {
	const { t } = useTranslation(["ui"]);
	const title = unit.title ?? t.ui.unnamed;
	return (
		<IdentityBadgeLink avatar={unit.avatar} href={publicUnitHref(unit.kind, unit)} label={title} />
	);
}

function DockUnitList({
	children,
	layout,
	presentation,
	units,
}: {
	readonly children: ReactNode;
	readonly layout: "list" | "grid" | "carousel" | "wrap";
	readonly presentation?: UnitListPresentation;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}) {
	const { t } = useTranslation(["feed", "ui"]);
	const heading = presentation?.headingUnitId
		? units.get(presentation.headingUnitId)?.title
		: undefined;
	const viewAllTarget = presentation?.viewAllTarget;
	const viewAllHref = viewAllTarget ? navigationTargetHref(viewAllTarget, units) : undefined;
	const list =
		presentation?.itemAppearance === "identity-badge" ? (
			<ul className={unitListClasses(layout)} data-part="items">
				{children}
			</ul>
		) : layout === "carousel" ? (
			<div data-part="items">
				<Shelf
					itemSize={presentation?.itemSize ?? "md"}
					labels={heading ? { ...t.ui.shelf, label: heading } : t.ui.shelf}
				>
					{children}
				</Shelf>
			</div>
		) : (
			<div className={unitListClasses(layout)} data-part="items">
				{children}
			</div>
		);
	if (!heading && !viewAllHref) return list;
	return (
		<div className="grid gap-3">
			<div className="flex min-w-0 items-center justify-between gap-3">
				{heading ? (
					<h2 className="min-w-0 truncate font-semibold text-lg" data-part="heading">
						{heading}
					</h2>
				) : null}
				{viewAllHref && viewAllTarget ? (
					<AppLink
						className="ms-auto shrink-0 font-medium text-link text-sm hover:underline"
						data-part="view-all"
						href={viewAllHref}
						rel={viewAllTarget.kind === "external" ? "noopener noreferrer" : undefined}
						target={viewAllTarget.kind === "external" ? "_blank" : undefined}
					>
						{t.feed.viewAll}
					</AppLink>
				) : null}
			</div>
			{list}
		</div>
	);
}

function unitListClasses(layout: "list" | "grid" | "carousel" | "wrap"): string {
	return cn(
		layout === "wrap" ? "flex flex-wrap items-center gap-2" : "grid gap-3",
		layout === "grid" && "sm:grid-cols-2",
	);
}

function DockCollection({
	collectionId,
	layout,
	limit,
	presentation,
	units,
}: {
	readonly collectionId: string;
	readonly layout: "list" | "grid" | "carousel" | "wrap";
	readonly limit: number;
	readonly presentation?: UnitListPresentation;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}) {
	const { t } = useTranslation(["ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsByCollectionIdItems({
		path: { collectionId },
		query: { limit, localizationLanguages },
	});
	if (query.isPending)
		return (
			<p className="text-muted-foreground text-sm" data-part="loading">
				{t.ui.loading}
			</p>
		);
	if (query.isError)
		return (
			<div data-part="error">
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			</div>
		);
	if (!query.data || query.data.items.length === 0) return <div data-part="empty" />;
	return (
		<DockUnitList layout={layout} presentation={presentation} units={units}>
			{presentation?.itemAppearance === "identity-badge"
				? query.data.items.map((item) => (
						<li data-part="item" key={item.membership.targetId}>
							<FeedItemIdentityBadge item={item.content} />
						</li>
					))
				: query.data.items.map((item) => (
						<div data-part="item" key={item.membership.targetId}>
							<FeedItemCard item={item.content} />
						</div>
					))}
		</DockUnitList>
	);
}

function DockNavigation({
	appearance,
	document,
	orientation,
	units,
}: {
	readonly appearance: "links" | "buttons" | "tabs" | "drawer";
	readonly document: NavigationDocumentValue;
	readonly orientation: "horizontal" | "vertical";
	readonly units: ReadonlyMap<string, UnitPresentation>;
}) {
	const { t } = useTranslation(["docks"]);
	return (
		<nav aria-label={t.docks.title}>
			<ul
				className={cn(
					"gap-2",
					orientation === "horizontal" ? "flex flex-wrap items-start" : "grid",
				)}
				data-part="list"
			>
				{document.items.map((item) => (
					<DockNavigationItem appearance={appearance} item={item} key={item._key} units={units} />
				))}
			</ul>
		</nav>
	);
}

function DockNavigationItem({
	appearance,
	item,
	units,
}: {
	readonly appearance: "links" | "buttons" | "tabs" | "drawer";
	readonly item: NavigationItem;
	readonly units: ReadonlyMap<string, UnitPresentation>;
}) {
	const { t } = useTranslation(["ui"]);
	const labelUnit = units.get(item.labelUnitId);
	if (!labelUnit) return null;
	const label = labelUnit.title ?? t.ui.unnamed;
	if ("children" in item)
		return (
			<li className="grid gap-2" data-part="item">
				<strong className="text-sm" data-part="label">
					{label}
				</strong>
				<ul className="grid gap-1 ps-3" data-part="list">
					{item.children.map((child) => (
						<DockNavigationItem
							appearance={appearance}
							item={child}
							key={child._key}
							units={units}
						/>
					))}
				</ul>
			</li>
		);
	const href = navigationTargetHref(item.target, units);
	if (!href) return null;
	return (
		<li data-part="item">
			<AppLink
				className={cn(
					"inline-flex min-h-9 items-center rounded-lg px-3 text-sm",
					appearance === "buttons" || appearance === "drawer"
						? "bg-secondary font-medium text-secondary-foreground"
						: "text-link hover:underline",
				)}
				data-part="link"
				href={href}
				rel={item.target.kind === "external" ? "noopener noreferrer" : undefined}
				target={item.target.kind === "external" ? "_blank" : undefined}
			>
				<span data-part="label">{label}</span>
			</AppLink>
		</li>
	);
}

function navigationTargetHref(
	target: NavigationTarget,
	units: ReadonlyMap<string, UnitPresentation>,
): string | undefined {
	if (target.kind === "external") return target.url;
	const unit = units.get(target.unitId);
	return unit ? (publicUnitHref(unit.kind, unit) ?? undefined) : undefined;
}
