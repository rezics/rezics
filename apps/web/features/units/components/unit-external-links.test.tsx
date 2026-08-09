/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => ({
	Badge: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	IdentityAvatar: ({ fallback }: { readonly fallback: string }) => (
		<span data-testid="source-avatar">{fallback}</span>
	),
	Popover: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	PopoverClose: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	PopoverContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("lucide-react", () => ({
	ExternalLink: () => <svg aria-hidden />,
}));
vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	useChineseContentText: (value: string) => value,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			ui: { unnamed: "Unnamed" },
			units: {
				detail: { externalLinks: "External links" },
				references: {
					pinned: "Pinned",
				},
			},
		},
	}),
}));

import {
	UnitExternalLinkBadge,
	UnitExternalLinkList,
	type UnitExternalLinkPresentation,
} from "./unit-external-links";

const link = {
	id: "00000000-0000-7000-8000-000000000001",
	unitId: "00000000-0000-7000-8000-000000000002",
	sourceEntityId: "00000000-0000-7000-8000-000000000003",
	url: "https://catalog.example.test/books/example",
	normalizedUrl: "https://catalog.example.test/books/example",
	normalizedUrlHash: "a".repeat(64),
	createdByProfileId: null,
	voteSummary: {
		positiveCount: 8,
		negativeCount: 1,
		score: 7,
		voteCount: 9,
		viewerVote: null,
		asOf: "2026-08-08T00:00:00.000Z",
	},
	pinned: true,
	position: "a0",
	createdAt: "2026-08-08T00:00:00.000Z",
	updatedAt: "2026-08-08T00:00:00.000Z",
	sourceEntity: {
		id: "00000000-0000-7000-8000-000000000003",
		kind: "entity",
		language: "en",
		title: "Example Catalog",
		summary: "The source catalog entry.",
		avatar: { type: "emoji", emoji: "📚" },
	},
} satisfies UnitExternalLinkPresentation;

describe("Unit external-link presentation", () => {
	afterEach(cleanup);

	it("omits the complete detail section when no links are available", () => {
		const { container } = render(<UnitExternalLinkList links={[]} />);

		expect(container.childElementCount).toBe(0);
	});

	it("renders the source presentation and preserves the external URL contract", () => {
		render(<UnitExternalLinkList links={[link]} />);

		expect(screen.getByRole("heading", { name: "External links" })).toBeTruthy();
		expect(screen.getAllByText("Example Catalog")).toHaveLength(2);
		expect(screen.getAllByTestId("source-avatar")).toHaveLength(2);
		expect(screen.getByText("Pinned")).toBeTruthy();
		const externalLink = screen.getByRole("link", { name: link.url });
		expect(externalLink.getAttribute("href")).toBe(link.url);
		expect(externalLink.getAttribute("target")).toBe("_blank");
		expect(externalLink.getAttribute("rel")).toBe("ugc nofollow noreferrer");
	});

	it("accepts owner-specific controls without coupling them to the shared badge", () => {
		render(
			<UnitExternalLinkBadge controls={<button type="button">Support</button>} link={link} />,
		);

		expect(screen.getByRole("button", { name: "Support" })).toBeTruthy();
	});
});
