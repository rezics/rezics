/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	contributions: vi.fn(),
	invalidateQueries: vi.fn(),
	visit: vi.fn(),
	workspace: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useListCurrentUserContributionResources: (input: unknown) => {
		api.contributions(input);
		return {
			data: { items: [{ id: "contribution-id", section: "tag" }] },
			isError: false,
			isPending: false,
			queryKey: ["contributions"],
			refetch: vi.fn(),
		};
	},
	useListCurrentUserStudioContent: (input: unknown) => {
		api.workspace(input);
		return {
			data: { items: [{ id: "workspace-id", section: "book" }] },
			isError: false,
			isPending: false,
			queryKey: ["workspace"],
			refetch: vi.fn(),
		};
	},
	useRecordCurrentUserStudioVisit: () => ({ mutate: api.visit }),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: api.invalidateQueries }),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

const sectionIds = [
	"post",
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"realm",
	"zone",
	"wiki",
	"collection",
	"review",
	"poll",
] as const;

vi.mock("../components/studio-workspace", () => ({
	useStudioWorkspaceSections: () =>
		sectionIds.map((id) => ({
			id,
			href: `/create/${id}`,
			label: id,
			description: `${id} description`,
			icon: (props: ComponentProps<"span">) => <span {...props} />,
			...(id === "zone" ? { badge: "Preview" } : {}),
		})),
}));

vi.mock("../components/studio-create-actions", () => ({
	StudioCreateActions: ({ sectionId }: { readonly sectionId: string }) => (
		<span data-testid="create-action">create:{sectionId}</span>
	),
}));

vi.mock("../components/studio-content-list", () => ({
	StudioContentList: ({
		mode,
		onOpen,
		state,
	}: {
		readonly mode: string;
		readonly onOpen: (item: unknown) => void;
		readonly state: { readonly items?: readonly unknown[] };
	}) => {
		const items = state.items ?? [];
		const first = items[0];
		return (
			<button data-testid={`${mode}-list`} onClick={() => first && onOpen(first)}>
				{items.length}
			</button>
		);
	},
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			create: {
				overview: {
					continueTitle: "Continue",
					createTitle: "Create",
					recentContributionsTitle: "Recent contributions",
					groups: {
						works: "Works",
						publishing: "Publishing",
						organization: "Organization",
						vocabulary: "Vocabulary",
					},
					empty: { workspace: "No workspace", contributions: "No contributions" },
				},
			},
		},
	}),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh", "en"],
}));

import { StudioOverviewPage } from "./studio-overview-page";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("StudioOverviewPage", () => {
	it("loads bounded aggregate lists and groups every creation section", () => {
		render(<StudioOverviewPage />);

		expect(api.workspace).toHaveBeenCalledWith({
			query: { localizationLanguages: ["zh", "en"], limit: 4 },
		});
		expect(api.contributions).toHaveBeenCalledWith({
			query: { localizationLanguages: ["zh", "en"], limit: 4 },
		});
		expect(screen.getByRole("heading", { name: "Continue" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Recent contributions" })).toBeTruthy();
		expect(screen.getAllByTestId("create-action")).toHaveLength(12);
		expect(screen.getByRole("link", { name: "book" }).getAttribute("href")).toBe("/create/book");

		fireEvent.click(screen.getByTestId("workspace-list"));
		expect(api.visit).toHaveBeenCalledWith({ path: { unitId: "workspace-id" } });
	});
});
