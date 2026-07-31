// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	usePostApiSearchByIndex: () => ({
		isPending: false,
		mutateAsync: api.mutateAsync,
	}),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			communityUnitSearch: {
				backToSection: ({ subject }: { readonly subject: string }) => `Back to ${subject}`,
				createAction: "Continue to create",
				noResultsDescription: "You can continue.",
				noResultsTitle: ({ subject }: { readonly subject: string }) =>
					`No matching ${subject} found`,
				notListedDescription: "Review similar entries.",
				notListedTitle: "None match?",
				realmTagContextOnly: "Only explicitly explained Realm Tags are available.",
				pageDescription: ({ subject }: { readonly subject: string }) =>
					`Check existing ${subject}.`,
				pageTitle: ({ subject }: { readonly subject: string }) =>
					`Search existing ${subject}`,
				policy: "Search before creating.",
				policyTitle: "Search first",
				resultsTitle: "Possible existing entries",
				searchAction: "Search",
				searchFailed: "Search failed.",
				searchHint: "Enter a name.",
				searchLabel: ({ subject }: { readonly subject: string }) => `Search ${subject}`,
				searchPlaceholder: ({ subject }: { readonly subject: string }) =>
					`Enter ${subject}`,
				subjects: {
					book: "books",
					character: "characters",
					media: "media entries",
					organization: "organizations",
					person: "people",
					software: "software entries",
					tag: "tags",
				},
			},
		},
	}),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh-Hant", "en"],
}));

import {
	TagCommunityUnitSearchSubject,
	unitCommunityUnitSearchSubject,
} from "@/features/create/model/community-unit-search";
import { CommunityUnitSearchPage } from "./community-unit-search-page";

beforeEach(() => {
	cleanup();
	api.mutateAsync.mockReset();
	api.mutateAsync.mockResolvedValue({ hits: [] });
});

describe("CommunityUnitSearchPage", () => {
	it("searches Units with the exact public-entry kind before offering creation", async () => {
		render(
			<CommunityUnitSearchPage
				initialQuery="Dune"
				subject={unitCommunityUnitSearchSubject("book")}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		await waitFor(() =>
			expect(api.mutateAsync).toHaveBeenCalledWith({
				body: {
					kinds: ["book"],
					limit: 20,
					localizationLanguages: ["zh-Hant", "en"],
					query: "Dune",
				},
				path: { index: "units" },
			}),
		);
		const createLink = await screen.findByRole("link", { name: "Continue to create" });
		const url = new URL(createLink.getAttribute("href") ?? "", "https://rezics.example");
		expect(url.pathname).toBe("/units/book/new");
		expect(url.searchParams.get("ownershipMode")).toBe("community_owned");
		expect(url.searchParams.get("title")).toBe("Dune");
	});

	it("uses the Tag domain without sending the unsupported kind filter", async () => {
		render(
			<CommunityUnitSearchPage
				initialQuery="science"
				subject={TagCommunityUnitSearchSubject}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		await waitFor(() =>
			expect(api.mutateAsync).toHaveBeenCalledWith({
				body: {
					limit: 20,
					localizationLanguages: ["zh-Hant", "en"],
					query: "science",
				},
				path: { index: "tags" },
			}),
		);
		expect(
			(await screen.findByRole("link", { name: "Continue to create" })).getAttribute("href"),
		).toContain("/create/tag/new?");
	});

	it("scopes Realm Tag search to explicit Contexts and does not offer creation", async () => {
		render(
			<CommunityUnitSearchPage
				initialQuery="science"
				subject={TagCommunityUnitSearchSubject}
				unitTagVoteTarget={{
					type: "book",
					unitId: "00000000-0000-7000-8000-000000000001",
					context: {
						kind: "realm",
						realmId: "00000000-0000-7000-8000-000000000002",
					},
				}}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		await waitFor(() =>
			expect(api.mutateAsync).toHaveBeenCalledWith({
				body: {
					limit: 20,
					localizationLanguages: ["zh-Hant", "en"],
					query: "science",
					realmTagContextRealmId: "00000000-0000-7000-8000-000000000002",
				},
				path: { index: "tags" },
			}),
		);
		expect(
			await screen.findByText("Only explicitly explained Realm Tags are available."),
		).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Continue to create" })).toBeNull();
	});
});
