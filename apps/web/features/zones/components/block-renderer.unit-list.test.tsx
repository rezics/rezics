/** @vitest-environment jsdom */

import type { Block } from "@rezics/block";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZoneRenderProjection } from "../model/zone-render";

const fixtures = vi.hoisted(() => ({
	collectionItems: [] as unknown[],
	searchResponse: {
		groups: [] as unknown[],
	},
}));

vi.mock("@rezics/filter", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/filter")>()),
	parseSearchFeatureDefinition: () => ({ filterDocument: {} }),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	postApiSearchFilterDefinition: vi.fn(),
	postApiSearchZonesByZoneIdFeedBlockExecutions: vi.fn(),
	useGetApiCollectionsByCollectionIdItems: () => ({
		data: { items: fixtures.collectionItems },
		isError: false,
		isPending: false,
	}),
	useGetApiSearchZonesByZoneIdFilter: () => ({
		data: undefined,
		isError: false,
		isPending: false,
	}),
	usePostApiSearchZonesByZoneIdDockBlockExecutions: () => ({
		isError: false,
		isPending: false,
		mutateAsync: vi.fn().mockResolvedValue(fixtures.searchResponse),
	}),
	usePostApiSearchZonesByZoneIdPagesByPageIdBlockExecutions: () => ({
		isError: false,
		isPending: false,
		mutateAsync: vi.fn().mockResolvedValue(fixtures.searchResponse),
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isError: false,
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useQuery: () => ({ data: {}, isError: false, isPending: false }),
}));

vi.mock("@rezics/ui", () => {
	const Container = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
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

vi.mock("@/features/content-feed/components/feed-content-selector", () => ({
	FeedContentSelector: () => null,
}));

vi.mock("@/features/content-feed/components/feed-item-card", () => ({
	FeedItemCard: () => <article data-testid="collection-card" />,
}));

vi.mock("@/features/content-feed/components/feed-list", () => ({
	FeedList: () => null,
}));

vi.mock("@/features/content-language-display/localized-portable-text-content", () => ({
	LocalizedPortableTextContent: () => null,
}));

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	LocalizedText: ({ value }: { readonly value: string }) => <>{value}</>,
	useChineseContentText: (value: string) => value,
}));

vi.mock("@/features/search/search-feature", () => ({
	SearchFeature: ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>,
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

import { ZoneBlockProvider, ZoneDocument } from "./block-renderer";

const ZoneId = "019f9000-0000-7000-8000-000000000001";
const ItemId = "019f9000-0000-7000-8000-000000000002";
const HeadingId = "019f9000-0000-7000-8000-000000000003";
const ViewAllId = "019f9000-0000-7000-8000-000000000004";
const CollectionId = "019f9000-0000-7000-8000-000000000005";
const CoverId = "019f9000-0000-7000-8000-000000000006";
const Timestamp = "2026-08-24T00:00:00.000Z";

type RenderUnit = ZoneRenderProjection["references"]["units"][number];

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
		customThemeStylesheet: null,
		navigations: [],
		page: null,
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
			themeDocument: {
				_key: "000000000001",
				_type: "zone-theme",
				accent: "#2563eb",
				colorScheme: "system",
				density: "comfortable",
			},
			updatedAt: Timestamp,
		},
	} satisfies ZoneRenderProjection;
}

function renderZone(block: Block, units: readonly RenderUnit[] = []) {
	return render(
		<ZoneBlockProvider baseHref="/zone/test" projection={projection(units)}>
			<ZoneDocument blocks={[block]} surface={{ kind: "dock" }} />
		</ZoneBlockProvider>,
	);
}

describe("Zone unit-list presentation", () => {
	afterEach(() => {
		cleanup();
		fixtures.collectionItems = [];
		fixtures.searchResponse = { groups: [] };
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

	it("renders Search results through Shelf and UnitCard", async () => {
		fixtures.searchResponse = {
			groups: [
				{
					hits: [
						{
							category: "units",
							id: ItemId,
							kind: "book",
							summary: "A stored-query result",
							title: "Search item",
						},
					],
					total: { kind: "exact", value: 1 },
				},
			],
		};
		const block = {
			_key: "000000000004",
			_type: "unit-list",
			layout: "carousel",
			limit: 6,
			presentation: { itemSize: "lg" },
			source: { feature: { kind: "global" }, kind: "search" },
		} satisfies Block;
		renderZone(block);

		await waitFor(() => expect(screen.getByTestId("shelf")).toBeTruthy());
		expect(screen.getByTestId("shelf").getAttribute("data-item-size")).toBe("lg");
		expect(screen.getByTestId("unit-card").getAttribute("href")).toBe(`/units/book/${ItemId}`);
		expect(screen.getByTestId("unit-card").textContent).toContain("Search item");
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
});
