/** @vitest-environment jsdom */

import type { Block } from "@rezics/block";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZoneRenderProjection } from "../model/zone-render";
import type { ZoneAggregateBlockState } from "../model/zone-page-aggregate";

const fixtures = vi.hoisted(() => ({
	aggregate: { kind: "legacy" } as ZoneAggregateBlockState,
	collectionItems: [] as unknown[],
	filterDefinition: vi.fn(),
	searchResponse: {
		groups: [] as unknown[],
		selectionSeed: undefined as string | undefined,
	},
	dockExecution: {
		isError: false,
		isPending: false,
		mutateAsync: vi.fn(),
	},
	pageExecution: {
		isError: false,
		isPending: false,
		mutateAsync: vi.fn(),
	},
	zoneFilter: {
		data: { controls: [], sorts: [] } as unknown,
		isError: false,
		isPending: false,
	},
}));

vi.mock("@rezics/filter", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/filter")>()),
	parseSearchFeatureDefinition: () => ({ filterDocument: {} }),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	postApiSearchFilterDefinition: (...args: unknown[]) => fixtures.filterDefinition(...args),
	postApiSearchZonesByZoneIdFeedBlockExecutions: vi.fn(),
	useGetApiCollectionsByCollectionIdItems: () => ({
		data: { items: fixtures.collectionItems },
		isError: false,
		isPending: false,
	}),
	useGetApiSearchZonesByZoneIdFilter: () => fixtures.zoneFilter,
	usePostApiSearchZonesByZoneIdDockBlockExecutions: () => fixtures.dockExecution,
	usePostApiSearchZonesByZoneIdPagesByPageIdBlockExecutions: () => fixtures.pageExecution,
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isError: false,
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useQuery: ({ enabled }: { readonly enabled?: boolean }) =>
		enabled === false
			? { data: undefined, isError: false, isPending: false }
			: { data: {}, isError: false, isPending: false },
}));

vi.mock("@rezics/ui", () => {
	const Container = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Button: ({
			children,
			onClick,
			...props
		}: {
			readonly children?: ReactNode;
			readonly onClick?: () => void;
			readonly [key: string]: unknown;
		}) => (
			<button onClick={onClick} type="button" {...props}>
				{children}
			</button>
		),
		Cover: ({ alt, src }: { readonly alt: string; readonly src?: string | null }) => (
			<div aria-label={alt} data-cover={src} data-testid="cover" role="img" />
		),
		IdentityAvatar: () => <span data-testid="identity-avatar" />,
		Menu: Container,
		MenuContent: Container,
		MenuItem: Container,
		MenuSub: Container,
		MenuSubContent: Container,
		MenuSubTrigger: Container,
		MenuTrigger: Container,
		Separator: () => <hr />,
		Tabs: Container,
		TabsContent: Container,
		TabsList: Container,
		TabsTrigger: Container,
		UnitCard: ({
			cover,
			fallback,
			href,
			title,
		}: {
			readonly cover?: { readonly url: string } | null;
			readonly fallback?: ReactNode;
			readonly href: string;
			readonly title: string;
		}) => (
			<a data-cover={cover?.url} data-testid="unit-card" href={href}>
				{fallback}
				{title}
			</a>
		),
		cn: (...classes: unknown[]) =>
			classes.filter((value): value is string => typeof value === "string").join(" "),
	};
});

vi.mock("@rezics/ui/custom/shelf", () => ({
	Shelf: ({
		children,
		itemSize,
		labels,
	}: {
		readonly children: ReactNode;
		readonly itemSize: "sm" | "md" | "lg";
		readonly labels: { readonly label: string };
	}) => (
		<div data-item-size={itemSize} data-label={labels.label} data-testid="shelf">
			{children}
		</div>
	),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({
		children,
		className,
		href,
		rel,
		target,
	}: {
		readonly children: ReactNode;
		readonly className?: string;
		readonly href: string;
		readonly rel?: string;
		readonly target?: string;
	}) => (
		<a className={className} href={href} rel={rel} target={target}>
			{children}
		</a>
	),
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/content-feed/components/feed-content-selector", () => ({
	FeedContentSelector: () => <div data-testid="feed-content-selector" />,
}));

vi.mock("@/features/content-feed/components/feed-item-card", () => ({
	FeedItemCard: () => <article data-testid="collection-card" />,
}));

vi.mock("@/features/block-composition/components/identity-badge-link", () => ({
	IdentityBadgeLink: ({ href, label }: { readonly href?: string; readonly label: string }) => (
		<a data-testid="identity-badge" href={href}>
			{label}
		</a>
	),
}));

vi.mock("@/features/content-feed/components/feed-item-identity-badge", () => ({
	FeedItemIdentityBadge: () => <a data-testid="collection-identity-badge">Theme</a>,
}));

vi.mock("@/features/content-feed/components/feed-list", () => ({
	FeedList: ({
		"aria-label": ariaLabel,
		continuation,
	}: {
		readonly "aria-label"?: string;
		readonly continuation?: {
			readonly mode: string;
			readonly state: { readonly status: string; readonly loadNext?: () => void };
		};
	}) => (
		<div
			aria-label={ariaLabel}
			data-continuation={continuation?.state.status}
			data-pagination={continuation?.mode}
			data-testid="feed-list"
		>
			{continuation?.state.status === "ready" ? (
				<button onClick={continuation.state.loadNext} type="button">
					Load more
				</button>
			) : null}
		</div>
	),
}));

vi.mock("@/features/content-language-display/localized-portable-text-content", () => ({
	LocalizedPortableTextContent: () => null,
}));

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	LocalizedText: ({ value }: { readonly value: string }) => <>{value}</>,
	useChineseContentText: (value: string) => value,
}));

vi.mock("@/features/search/search-feature", () => ({
	SearchFeature: ({
		children,
		parts,
		showSortControl,
		toolbarFilters,
	}: {
		readonly children?: ReactNode;
		readonly parts?: {
			readonly filters?: string;
			readonly form?: string;
			readonly query?: string;
			readonly submit?: string;
			readonly toolbar?: string;
		};
		readonly showSortControl?: boolean;
		readonly toolbarFilters?: ReactNode;
	}) => (
		<form data-part={parts?.form} data-testid="search-feature">
			<input data-part={parts?.query} data-testid="search-query" />
			<button data-part={parts?.submit} data-testid="search-submit" type="submit">
				Search
			</button>
			{parts?.filters ? (
				<div data-part={parts.filters} data-testid="search-filters">
					Filters
				</div>
			) : null}
			{showSortControl === false ? null : <div data-testid="search-sort">Sort</div>}
			{parts?.toolbar ? (
				<div data-part={parts.toolbar} data-testid="search-toolbar">
					Toolbar
				</div>
			) : null}
			{toolbarFilters}
			{children}
		</form>
	),
}));

vi.mock("@/i18n/client", () => {
	const messages = {
		actions: { retry: "Retry" },
		feed: {
			emptyBody: "No content",
			emptyTitle: "Empty",
			title: "Feed",
			viewAll: "View all",
		},
		search: {
			atLeastResultCount: ({ count }: { count: number }) => `At least ${count}`,
			resultCount: ({ count }: { count: number }) => `${count} results`,
		},
		state: { error: "Error" },
		ui: {
			loading: "Loading…",
			shelf: {
				item: ({ item, itemCount }: { item: number; itemCount: number }) => `${item}/${itemCount}`,
				label: "Content shelf",
				next: "Next items",
				page: ({ page, pageCount }: { page: number; pageCount: number }) => `${page}/${pageCount}`,
				previous: "Previous items",
			},
			unnamed: "Untitled",
		},
		zones: {
			contentList: "Content list",
			loadSection: "Load this section",
			searchEmpty: "No matching content",
			searchFailed: "Search failed",
			searchResults: "Search results",
			untitledResult: "Untitled result",
		},
	};
	type MessageNamespace = keyof typeof messages;
	const namespaceMessages = (namespace: MessageNamespace) => messages[namespace];
	return {
		useTranslation: (namespaces: MessageNamespace | readonly MessageNamespace[]) => ({
			t: Array.isArray(namespaces)
				? Object.fromEntries(
						namespaces.map((namespace) => [namespace, namespaceMessages(namespace)]),
					)
				: namespaceMessages(namespaces as MessageNamespace),
		}),
	};
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

vi.mock("./zone-page-aggregate-provider", () => ({
	useZoneAggregateBlockState: () => fixtures.aggregate,
	useZoneAggregateStatus: () => "legacy",
}));

import { ZoneBlockProvider, ZoneDocument } from "./block-renderer";

const ZoneId = "019f9000-0000-7000-8000-000000000001";
const ItemId = "019f9000-0000-7000-8000-000000000002";
const HeadingId = "019f9000-0000-7000-8000-000000000003";
const ViewAllId = "019f9000-0000-7000-8000-000000000004";
const CollectionId = "019f9000-0000-7000-8000-000000000005";
const CoverId = "019f9000-0000-7000-8000-000000000006";
const PageId = "019f9000-0000-7000-8000-000000000007";
const Timestamp = "2026-08-24T00:00:00.000Z";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];
type ZoneSurface = { readonly kind: "dock" } | { readonly kind: "page"; readonly pageId: string };

function unit(id: string, kind: string, title: string, cover: RenderUnit["cover"] = null) {
	return {
		avatar: null,
		banner: null,
		cover,
		id,
		kind,
		language: "en",
		summary: null,
		title,
		zonePageSlug: null,
	} satisfies RenderUnit;
}

function projection(units: readonly RenderUnit[]) {
	return {
		dock: null,
		navigations: [],
		page: null,
		resolvedPresentation: {
			targetContract: "rezics.unit.presentation@0",
			document: {
				_type: "unit-presentation-document",
				_key: "000000000010",
				header: { _type: "block-document", _key: "000000000011", blocks: [] },
				footer: { _type: "block-document", _key: "000000000012", blocks: [] },
			},
			documentRevisionId: null,
			customTheme: null,
			fallbackReason: "none_installed",
		},
		references: { assets: [], units: [...units], wikiPosts: [] },
		zone: {
			avatar: null,
			banner: null,
			capabilities: {
				canManage: false,
				canManageTheme: false,
				hasDevelopmentPreviewAccess: false,
			},
			cover: null,
			createdAt: Timestamp,
			endsAt: null,
			filterDocument: {},
			id: ZoneId,
			language: "en",
			localRuleRealmId: null,
			localizations: [],
			slugAddress: null,
			startsAt: null,
			themeHero: null,
			appearanceDocument: {
				_key: "000000000001",
				_type: "zone-appearance",
				accent: "#2563eb",
				colorScheme: "system",
				density: "comfortable",
			},
			updatedAt: Timestamp,
		},
	} satisfies ZoneRenderProjection;
}

function searchHit(title = "Search item") {
	return {
		category: "units",
		id: ItemId,
		kind: "book",
		summary: "A stored-query result",
		title,
	};
}

function searchUnitList(overrides: Partial<Extract<Block, { _type: "unit-list" }>> = {}) {
	return {
		_key: "000000000004",
		_type: "unit-list",
		layout: "carousel",
		limit: 6,
		presentation: { itemSize: "lg" },
		source: { feature: { kind: "zone" }, kind: "search" },
		...overrides,
	} satisfies Block;
}

function derivedUnitList() {
	return {
		_key: "000000000014",
		_type: "unit-list",
		layout: "carousel",
		limit: 8,
		presentation: { itemSize: "sm" },
		source: {
			kind: "derived",
			select: {
				kind: "random-tag",
				from: { kind: "viewer-follows" },
				seed: { kind: "request" },
			},
			query: { feature: { kind: "zone" }, sort: "best" },
			fallback: { kind: "collection", collectionId: CollectionId },
		},
	} satisfies Block;
}

function renderZone(
	block: Block,
	units: readonly RenderUnit[] = [],
	surface: ZoneSurface = { kind: "dock" },
) {
	return render(
		<ZoneBlockProvider baseHref="/zone/test" projection={projection(units)}>
			<ZoneDocument blocks={[block]} surface={surface} />
		</ZoneBlockProvider>,
	);
}

function expectPresetShelf() {
	expect(screen.queryByTestId("search-feature")).toBeNull();
	expect(screen.queryByTestId("search-query")).toBeNull();
	expect(screen.queryByTestId("search-submit")).toBeNull();
	expect(screen.queryByTestId("search-filters")).toBeNull();
	expect(screen.queryByTestId("search-sort")).toBeNull();
	expect(fixtures.filterDefinition).not.toHaveBeenCalled();
}

describe("Zone unit-list presentation", () => {
	afterEach(() => {
		cleanup();
		fixtures.aggregate = { kind: "legacy" };
		fixtures.collectionItems = [];
		fixtures.searchResponse = { groups: [], selectionSeed: undefined };
		fixtures.dockExecution.isError = false;
		fixtures.dockExecution.isPending = false;
		fixtures.dockExecution.mutateAsync.mockReset();
		fixtures.dockExecution.mutateAsync.mockImplementation(async () => fixtures.searchResponse);
		fixtures.pageExecution.isError = false;
		fixtures.pageExecution.isPending = false;
		fixtures.pageExecution.mutateAsync.mockReset();
		fixtures.pageExecution.mutateAsync.mockImplementation(async () => fixtures.searchResponse);
		fixtures.filterDefinition.mockReset();
		fixtures.zoneFilter = {
			data: { controls: [], sorts: [] },
			isError: false,
			isPending: false,
		};
	});

	it("renders referenced Units through Shelf with the default density and resolved chrome", () => {
		const block = {
			_key: "000000000002",
			_type: "unit-list",
			layout: "carousel",
			limit: 10,
			presentation: {
				headingUnitId: HeadingId,
				viewAllTarget: { kind: "unit", unitId: ViewAllId },
			},
			source: { kind: "units", unitIds: [ItemId] },
		} satisfies Block;
		renderZone(block, [
			unit(ItemId, "book", "Shelf item", { id: CoverId, url: "/cover.jpg" }),
			unit(HeadingId, "label", "Featured books"),
			unit(ViewAllId, "collection", "All books"),
		]);

		const shelf = screen.getByTestId("shelf");
		expect(shelf.getAttribute("data-item-size")).toBe("md");
		expect(shelf.getAttribute("data-label")).toBe("Featured books");
		expect(screen.getByRole("heading", { name: "Featured books" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "View all" }).getAttribute("href")).toBe(
			`/collections/${ViewAllId}`,
		);
		const card = screen.getByTestId("unit-card");
		expect(card.getAttribute("data-cover")).toBe("/cover.jpg");
		expect(card.getAttribute("href")).toBe(`/units/book/${ItemId}`);
	});

	it("marks the rendered scope as a Zone appearance surface", () => {
		const block = {
			_key: "000000000009",
			_type: "divider",
			style: "line",
		} satisfies Block;
		const { container } = renderZone(block);

		expect(container.querySelector("[data-zone-appearance-scope]")).toBeTruthy();
	});

	it("renders collection items through Shelf with explicit density", () => {
		fixtures.collectionItems = [
			{
				content: { id: ItemId },
				membership: { targetId: ItemId },
			},
		];
		const block = {
			_key: "000000000003",
			_type: "unit-list",
			layout: "carousel",
			limit: 6,
			presentation: { itemSize: "sm" },
			source: { collectionId: CollectionId, kind: "collection" },
		} satisfies Block;
		renderZone(block);

		expect(screen.getByTestId("shelf").getAttribute("data-item-size")).toBe("sm");
		expect(screen.getByTestId("collection-card")).toBeTruthy();
	});

	it("renders collection identities as wrapping badges instead of Feed Cards", () => {
		fixtures.collectionItems = [
			{
				content: { id: ItemId },
				membership: { targetId: ItemId },
			},
		];
		const block = {
			_key: "000000000015",
			_type: "unit-list",
			layout: "wrap",
			limit: 8,
			presentation: { itemAppearance: "identity-badge" },
			source: { collectionId: CollectionId, kind: "collection" },
		} satisfies Block;
		renderZone(block);

		expect(screen.queryByTestId("shelf")).toBeNull();
		expect(screen.queryByTestId("collection-card")).toBeNull();
		expect(screen.getByTestId("collection-identity-badge")).toBeTruthy();
		expect(screen.getByRole("list").className).toContain("flex-wrap");
	});

	it("renders Search results through Shelf and UnitCard", async () => {
		fixtures.searchResponse = {
			groups: [
				{
					hits: [searchHit()],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: undefined,
		};
		renderZone(searchUnitList());

		await waitFor(() => expect(screen.getByTestId("shelf")).toBeTruthy());
		expect(screen.getByTestId("shelf").getAttribute("data-item-size")).toBe("lg");
		expect(screen.getByTestId("unit-card").getAttribute("href")).toBe(`/units/book/${ItemId}`);
		expect(screen.getByTestId("unit-card").textContent).toContain("Search item");
		expectPresetShelf();
	});

	it("keeps grid Unit Lists on the non-carousel path", () => {
		const block = {
			_key: "000000000005",
			_type: "unit-list",
			layout: "grid",
			limit: 10,
			presentation: { itemSize: "lg" },
			source: { kind: "units", unitIds: [ItemId] },
		} satisfies Block;
		renderZone(block, [unit(ItemId, "book", "Grid item")]);

		expect(screen.queryByTestId("shelf")).toBeNull();
		expect(screen.getByRole("list").className).toContain("sm:grid-cols-2");
	});

	it("renders an aggregate-backed search unit-list as a non-interactive shelf", () => {
		fixtures.aggregate = {
			kind: "ok",
			blockType: "unit-list",
			itemKind: "search-hit",
			items: [searchHit("Aggregate item")],
			total: { kind: "exact", value: 1 },
			selectionSeed: "seed-from-server",
		};
		renderZone(searchUnitList());

		expect(screen.getByTestId("shelf")).toBeTruthy();
		expect(screen.getByTestId("unit-card").textContent).toContain("Aggregate item");
		expect(fixtures.dockExecution.mutateAsync).not.toHaveBeenCalled();
		expectPresetShelf();
	});

	it("renders an aggregate-backed derived unit-list as a non-interactive shelf", () => {
		fixtures.aggregate = {
			kind: "ok",
			blockType: "unit-list",
			itemKind: "search-hit",
			items: [searchHit("Derived item")],
			total: { kind: "exact", value: 1 },
		};
		renderZone(derivedUnitList());

		expect(screen.getByTestId("shelf")).toBeTruthy();
		expect(screen.getByTestId("unit-card").textContent).toContain("Derived item");
		expect(fixtures.dockExecution.mutateAsync).not.toHaveBeenCalled();
		expectPresetShelf();
	});

	it("executes a legacy aggregate search once with a bounded page size", async () => {
		fixtures.searchResponse = {
			groups: [
				{
					hits: [searchHit()],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: undefined,
		};
		renderZone(searchUnitList({ limit: 80 }));

		await waitFor(() => expect(fixtures.dockExecution.mutateAsync).toHaveBeenCalledTimes(1));
		expect(fixtures.dockExecution.mutateAsync).toHaveBeenCalledWith({
			body: {
				state: { pageSize: 50 },
				localizationLanguages: ["en"],
				path: [{ slot: "blocks", key: "000000000004" }],
			},
			path: { zoneId: ZoneId },
		});
		expectPresetShelf();
	});

	it("executes an inactive-tab skipped search once and keeps the server selection seed", async () => {
		fixtures.aggregate = { kind: "skipped", reason: "inactive-tab" };
		fixtures.searchResponse = {
			groups: [
				{
					hits: [searchHit()],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: "tab-seed",
		};
		renderZone(searchUnitList());

		await waitFor(() => expect(fixtures.dockExecution.mutateAsync).toHaveBeenCalledTimes(1));
		expect(fixtures.dockExecution.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
			body: {
				state: { pageSize: 6 },
				localizationLanguages: ["en"],
				path: [{ slot: "blocks", key: "000000000004" }],
			},
		});
		await waitFor(() => expect(screen.getByTestId("unit-card")).toBeTruthy());
		expectPresetShelf();
	});

	it("renders loadSection for a budget-skipped search and executes once when activated", async () => {
		fixtures.aggregate = { kind: "skipped", reason: "budget" };
		let resolveExecution: ((value: typeof fixtures.searchResponse) => void) | undefined;
		fixtures.dockExecution.mutateAsync.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveExecution = resolve;
				}),
		);
		renderZone(searchUnitList());

		expect(screen.getByRole("button", { name: "Load this section" })).toBeTruthy();
		expect(fixtures.dockExecution.mutateAsync).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Load this section" }));
		expect(await screen.findByText("Loading…")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Load this section" })).toBeNull();
		expect(fixtures.dockExecution.mutateAsync).toHaveBeenCalledTimes(1);
		resolveExecution?.({
			groups: [
				{
					hits: [searchHit("Loaded item")],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: "after-load",
		});
		await waitFor(() =>
			expect(screen.getByTestId("unit-card").textContent).toContain("Loaded item"),
		);
		expect(screen.queryByRole("button", { name: "Load this section" })).toBeNull();
		expectPresetShelf();
	});

	it("uses localized pending, empty, and failure states", () => {
		fixtures.aggregate = { kind: "pending" };
		const { unmount } = renderZone(searchUnitList());
		expect(screen.getByText("Loading…")).toBeTruthy();
		unmount();

		fixtures.aggregate = { kind: "error", code: "unavailable" };
		const errorRender = renderZone(searchUnitList());
		expect(screen.getByText("Search failed")).toBeTruthy();
		errorRender.unmount();

		fixtures.aggregate = {
			kind: "ok",
			blockType: "unit-list",
			itemKind: "feed-item",
			items: [],
		};
		const wrongKind = renderZone(searchUnitList());
		expect(screen.getByText("Search failed")).toBeTruthy();
		wrongKind.unmount();

		fixtures.aggregate = { kind: "legacy" };
		fixtures.dockExecution.isError = true;
		const queryFailure = renderZone(searchUnitList());
		expect(screen.getByText("Search failed")).toBeTruthy();
		queryFailure.unmount();

		fixtures.dockExecution.isError = false;
		fixtures.aggregate = {
			kind: "ok",
			blockType: "unit-list",
			itemKind: "search-hit",
			items: [],
			total: { kind: "exact", value: 0 },
		};
		renderZone(searchUnitList());
		expect(screen.getByText("No matching content")).toBeTruthy();
	});

	it("sends the canonical BlockPath to the page execution endpoint", async () => {
		fixtures.searchResponse = {
			groups: [
				{
					hits: [searchHit()],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: "page-seed",
		};
		renderZone(searchUnitList(), [], { kind: "page", pageId: PageId });

		await waitFor(() => expect(fixtures.pageExecution.mutateAsync).toHaveBeenCalledTimes(1));
		expect(fixtures.dockExecution.mutateAsync).not.toHaveBeenCalled();
		expect(fixtures.pageExecution.mutateAsync).toHaveBeenCalledWith({
			body: {
				state: { pageSize: 6 },
				localizationLanguages: ["en"],
				path: [{ slot: "blocks", key: "000000000004" }],
			},
			path: { pageId: PageId, zoneId: ZoneId },
		});
	});

	it("renders the full Search form for an explicit search Block", () => {
		renderZone({
			_key: "000000000020",
			_type: "search",
			feature: { kind: "zone" },
		});

		expect(screen.getByTestId("search-feature")).toBeTruthy();
		expect(screen.getByTestId("search-query")).toBeTruthy();
		expect(screen.getByTestId("search-submit")).toBeTruthy();
		expect(screen.getByTestId("search-filters")).toBeTruthy();
		expect(screen.getByTestId("search-sort")).toBeTruthy();
		expect(screen.queryByTestId("shelf")).toBeNull();
	});

	it("exposes feed toolbar and paging controls", () => {
		fixtures.aggregate = {
			kind: "ok",
			blockType: "feed",
			itemKind: "feed-item",
			items: [{ id: ItemId } as never],
			nextCursor: "cursor-1",
			total: { kind: "exact", value: 20 },
		};
		renderZone({
			_key: "000000000021",
			_type: "feed",
			feature: { kind: "zone" },
			presentation: { pagination: "load-more", showResultCount: false },
		});

		expect(screen.getByTestId("search-feature")).toBeTruthy();
		expect(screen.getByTestId("search-toolbar")).toBeTruthy();
		expect(screen.getByTestId("feed-list").getAttribute("data-pagination")).toBe("load-more");
		expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
	});

	it("does not mount a document Search form on a Zone home that only has preset shelves", async () => {
		fixtures.searchResponse = {
			groups: [
				{
					hits: [searchHit()],
					total: { kind: "exact", value: 1 },
				},
			],
			selectionSeed: undefined,
		};
		renderZone(searchUnitList());
		await waitFor(() => expect(screen.getByTestId("shelf")).toBeTruthy());
		expectPresetShelf();
	});
});
