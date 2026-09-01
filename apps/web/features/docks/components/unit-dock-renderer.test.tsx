/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
	collectionItems: [] as unknown[],
	document: null as unknown,
	presentations: [] as unknown[],
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	postApiUnitsPresentations: vi.fn(),
	useGetApiCollectionsByCollectionIdItems: () => ({
		data: { items: fixtures.collectionItems },
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
	useGetApiRealmsByRealmIdWikiNavigation: () => ({
		data: undefined,
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
	useGetApiUnitsByIdByUnitIdDocksByKind: () => ({
		data: { document: fixtures.document },
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: fixtures.presentations,
		error: null,
		isError: false,
		isPending: false,
	}),
}));

vi.mock("@rezics/ui", () => ({
	Card: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	IdentityAvatar: () => <span data-testid="identity-avatar" />,
	QueryFailure: () => <div>query-failure</div>,
	Separator: () => <hr />,
	Tabs: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	TabsContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	TabsList: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	TabsTrigger: ({ children }: { readonly children: ReactNode }) => <button>{children}</button>,
	UnitCard: ({
		cover,
		fallback,
		headingAs,
		href,
		title,
	}: {
		readonly cover?: { readonly url: string } | null;
		readonly fallback?: ReactNode;
		readonly headingAs?: "h2" | "h3";
		readonly href: string;
		readonly title: string;
	}) => (
		<a data-cover={cover?.url} data-heading-as={headingAs} data-testid="unit-card" href={href}>
			{fallback}
			{title}
		</a>
	),
	cn: (...classes: unknown[]) =>
		classes.filter((value): value is string => typeof value === "string").join(" "),
}));

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

vi.mock("@/features/units/routing/public-unit-route", () => ({
	publicUnitHref: (kind: string, unit: { readonly id: string }) => `/units/${kind}/${unit.id}`,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			docks: {
				kinds: {
					main: { label: "Main dock" },
					wiki: { label: "Wiki dock" },
				},
				title: "Dock",
			},
			feed: { viewAll: "View all" },
			ui: {
				shelf: {
					item: ({ item, itemCount }: { item: number; itemCount: number }) =>
						`${item}/${itemCount}`,
					label: "Items",
					next: "Next",
					page: ({ page, pageCount }: { page: number; pageCount: number }) =>
						`${page}/${pageCount}`,
					previous: "Previous",
				},
				unnamed: "Untitled",
			},
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({
	RequestFailure: () => null,
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

import { UnitDockRenderer } from "./unit-dock-renderer";

const OwnerId = "019f9000-0000-7000-8000-000000000001";
const ItemId = "019f9000-0000-7000-8000-000000000002";
const HeadingId = "019f9000-0000-7000-8000-000000000003";
const ViewAllId = "019f9000-0000-7000-8000-000000000004";
const CollectionId = "019f9000-0000-7000-8000-000000000005";

function presentation(id: string, title: string) {
	return {
		avatar: null,
		id,
		kind: "book",
		language: "en",
		summary: null,
		title,
	};
}

function renderDock() {
	return render(
		<UnitDockRenderer ownerUnitId={OwnerId} target={{ dockKind: "main", ownerKind: "book" }} />,
	);
}

describe("UnitDockRenderer unit-list presentation", () => {
	afterEach(() => {
		cleanup();
		fixtures.collectionItems = [];
		fixtures.document = null;
		fixtures.presentations = [];
	});

	it("renders a units carousel through Shelf with the default md density and resolved chrome", () => {
		fixtures.document = {
			_key: "000000000001",
			_type: "dock-document",
			blocks: [
				{
					_key: "000000000002",
					_type: "unit-list",
					layout: "carousel",
					limit: 10,
					presentation: {
						headingUnitId: HeadingId,
						viewAllTarget: { kind: "unit", unitId: ViewAllId },
					},
					source: { kind: "units", unitIds: [ItemId] },
				},
			],
		};
		fixtures.presentations = [
			{
				...presentation(ItemId, "Shelf item"),
				avatar: {
					image: { id: "019f9000-0000-7000-8000-000000000006", url: "/cover.jpg" },
					type: "image",
				},
			},
			presentation(HeadingId, "Featured books"),
			presentation(ViewAllId, "All books"),
		];

		renderDock();

		const shelf = screen.getByTestId("shelf");
		expect(shelf.getAttribute("data-item-size")).toBe("md");
		expect(shelf.getAttribute("data-label")).toBe("Featured books");
		expect(screen.getByRole("heading", { name: "Featured books" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "View all" }).getAttribute("href")).toBe(
			`/units/book/${ViewAllId}`,
		);
		const card = screen.getByTestId("unit-card");
		expect(card.getAttribute("href")).toBe(`/units/book/${ItemId}`);
		expect(card.getAttribute("data-cover")).toBeNull();
		expect(card.getAttribute("data-heading-as")).toBe("h3");
		expect(screen.getByTestId("identity-avatar")).toBeTruthy();
	});

	it("renders a collection carousel through Shelf with its explicit density", () => {
		fixtures.document = {
			_key: "000000000003",
			_type: "dock-document",
			blocks: [
				{
					_key: "000000000004",
					_type: "unit-list",
					layout: "carousel",
					limit: 6,
					presentation: { itemSize: "sm" },
					source: { collectionId: CollectionId, kind: "collection" },
				},
			],
		};
		fixtures.collectionItems = [
			{
				content: { id: ItemId },
				membership: { targetId: ItemId },
			},
		];

		renderDock();

		expect(screen.getByTestId("shelf").getAttribute("data-item-size")).toBe("sm");
		expect(screen.getByTestId("shelf").getAttribute("data-label")).toBe("Items");
		expect(screen.getByTestId("collection-card")).toBeTruthy();
	});

	it("renders collection identities as wrapping badges instead of Feed Cards", () => {
		fixtures.document = {
			_key: "000000000010",
			_type: "dock-document",
			blocks: [
				{
					_key: "000000000011",
					_type: "unit-list",
					layout: "wrap",
					limit: 8,
					presentation: { itemAppearance: "identity-badge" },
					source: { collectionId: CollectionId, kind: "collection" },
				},
			],
		};
		fixtures.collectionItems = [
			{
				content: { id: ItemId },
				membership: { targetId: ItemId },
			},
		];

		renderDock();

		expect(screen.queryByTestId("shelf")).toBeNull();
		expect(screen.queryByTestId("collection-card")).toBeNull();
		expect(screen.getByTestId("collection-identity-badge")).toBeTruthy();
		expect(screen.getByRole("list").className).toContain("flex-wrap");
	});

	it("keeps grid lists on the non-carousel path", () => {
		fixtures.document = {
			_key: "000000000005",
			_type: "dock-document",
			blocks: [
				{
					_key: "000000000006",
					_type: "unit-list",
					layout: "grid",
					limit: 10,
					presentation: { itemSize: "lg" },
					source: { kind: "units", unitIds: [ItemId] },
				},
			],
		};
		fixtures.presentations = [presentation(ItemId, "Grid item")];

		renderDock();

		expect(screen.queryByTestId("shelf")).toBeNull();
		const card = screen.getByTestId("unit-card");
		expect(card.getAttribute("data-heading-as")).toBe("h2");
		expect(card.closest('[data-part="items"]')?.className).toContain("sm:grid-cols-2");
	});

	it("renders managed and URL images from their distinct sources", () => {
		const assetId = "019f9000-0000-7000-8000-000000000006";
		fixtures.document = {
			_key: "000000000007",
			_type: "dock-document",
			blocks: [
				{
					_key: "000000000008",
					_type: "image",
					alt: "Managed cover",
					assetId,
					caption: "Managed caption",
				},
				{
					_key: "000000000009",
					_type: "url-image",
					alt: "Remote artwork",
					url: "https://images.example/random",
				},
			],
		};

		renderDock();

		expect(screen.getByRole("img", { name: "Managed cover" }).getAttribute("src")).toBe(
			`/image-assets/${assetId}/content`,
		);
		expect(screen.getByText("Managed caption")).toBeTruthy();
		expect(screen.getByRole("img", { name: "Remote artwork" }).getAttribute("src")).toBe(
			"https://images.example/random",
		);
	});
});
