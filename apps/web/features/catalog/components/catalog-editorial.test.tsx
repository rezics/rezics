/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ReadCatalogEditorialStatus200,
	ListCatalogEditorialLanguagesStatus200,
} from "@rezics/openapi-tanstack-query";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
	list: vi.fn(),
	read: vi.fn(),
	requested: undefined as string | undefined,
}));
vi.mock("@rezics/openapi-tanstack-query", () => ({
	useListCatalogEditorialLanguages: (...args: unknown[]) => api.list(...args),
	useReadCatalogEditorial: (...args: unknown[]) => api.read(...args),
}));
vi.mock("@/features/content-languages/hooks/use-content-language-navigation", () => ({
	useRequestedContentLanguage: () => api.requested,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { current: "en", target: "en" },
		t: { ui: { description: "Description" } },
	}),
}));
vi.mock("@rezics/ui", () => ({
	Banner: ({ src, alt }: { src: string; alt: string }) => (
		<img alt={alt} src={src} data-testid="editorial-banner" />
	),
	Cover: ({ src, alt }: { src: string; alt: string }) => (
		<img alt={alt} src={src} data-testid="editorial-cover" />
	),
	IdentityAvatar: () => null,
	QueryPending: () => <span>Loading</span>,
	QueryFailure: () => <span>Failed</span>,
	Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));
vi.mock("@/features/content-language-display/localized-portable-text-content", () => ({
	LocalizedPortableTextContent: ({ value }: { value: unknown }) => (
		<div data-testid="editorial-description">{JSON.stringify(value)}</div>
	),
}));
import { CatalogEditorialSection } from "./catalog-editorial";

const EntityId = "00000000-0000-7000-8000-000000000001";
function editorial(
	language: string,
	text: string,
	coverUrl: string,
): ReadCatalogEditorialStatus200 {
	const coverAssetId = "00000000-0000-7000-8000-000000000011";
	return {
		language,
		revision: 7,
		editorialRevision: 2,
		content: {
			summary: language === "en" ? "A principal character." : "Un personnage principal.",
			description: {
				_type: "portable-text",
				_key: "111111111111",
				content: [
					{
						_type: "block",
						_key: "description-block",
						style: "normal",
						children: [{ _type: "span", _key: "description-span", text, marks: [] }],
						markDefs: [],
					},
				],
			},
			avatar: null,
			bannerAssetId: null,
			coverAssetId,
		},
		avatar: null,
		banner: null,
		cover: { id: coverAssetId, url: coverUrl },
	};
}
const snapshots = new Map([
	["en", editorial("en", "A legendary king.", "https://example.com/localized-cover.webp")],
	["fr", editorial("fr", "Un roi légendaire.", "https://example.com/french-cover.webp")],
]);
const languages: ListCatalogEditorialLanguagesStatus200 = {
	items: [
		{ language: "ja", editorialRevision: 4, state: "withdrawn" },
		{ language: "en", editorialRevision: 2, state: "active" },
		{ language: "fr", editorialRevision: 2, state: "active" },
	],
};
beforeEach(() => {
	api.requested = undefined;
	api.list.mockReturnValue({ data: languages, isPending: false, isError: false });
	api.read.mockImplementation(
		({ path }: { path: { owner: string; id: string; language: string } }) => {
			const data = snapshots.get(path.language);
			if (!data) throw new Error(`Unexpected editorial language ${path.language}`);
			return { data, isPending: false, isError: false };
		},
	);
});
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("CatalogEditorialSection", () => {
	it("renders the selected native language cover, summary and full description", () => {
		render(<CatalogEditorialSection reference={{ owner: "entity", id: EntityId }} />);
		expect(screen.getByTestId("editorial-cover").getAttribute("src")).toBe(
			"https://example.com/localized-cover.webp",
		);
		expect(screen.getByText("A principal character.")).toBeTruthy();
		expect(screen.getByTestId("editorial-description").textContent).toContain("A legendary king.");
		expect(api.read).toHaveBeenCalledWith({
			path: { owner: "entity", id: EntityId, language: "en" },
		});
	});
	it("uses the requested active language without displaying a withdrawn language", () => {
		api.requested = "fr";
		render(<CatalogEditorialSection reference={{ owner: "entity", id: EntityId }} />);
		expect(screen.getByTestId("editorial-cover").getAttribute("src")).toBe(
			"https://example.com/french-cover.webp",
		);
		expect(screen.getByTestId("editorial-description").textContent).toContain("Un roi légendaire.");
		expect(api.read).toHaveBeenCalledWith({
			path: { owner: "entity", id: EntityId, language: "fr" },
		});
	});
});
