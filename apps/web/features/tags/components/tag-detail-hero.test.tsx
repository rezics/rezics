/** @vitest-environment jsdom */

import type { GetApiTagsByTagIdStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => ({
	Button: ({
		asChild,
		children,
		...props
	}: ComponentProps<"button"> & { readonly asChild?: boolean }) =>
		asChild && isValidElement(children) ? (
			cloneElement(children, props)
		) : (
			<button type="button" {...props}>
				{children}
			</button>
		),
	IdentityAvatar: ({ imageAlt }: { readonly imageAlt: string }) => <div aria-label={imageAlt} />,
	Tooltip: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
	TooltipContent: ({ children }: { readonly children: ReactNode }) => <span>{children}</span>,
	TooltipTrigger: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	LocalizedText: ({ value }: { readonly value: string }) => <>{value}</>,
}));

vi.mock("@/features/content-languages/components/content-language-version-menu", () => ({
	ContentLanguageVersionMenu: () => <span>Languages</span>,
}));

vi.mock("@/features/content-feed/components/feed-card-actions", () => ({
	ConnectedFeedEngagementBar: ({
		discussionHref,
		showShare,
	}: {
		readonly discussionHref: string;
		readonly showShare: boolean;
	}) => (
		<a data-show-share={String(showShare)} href={discussionHref}>
			Discussion
		</a>
	),
}));

vi.mock("@/features/following/components/follow-button", () => ({
	FollowButton: () => <button type="button">Follow</button>,
}));

vi.mock("@/features/reports/components/unit-report-dialog", () => ({
	UnitReportOverflowMenu: () => <button type="button">More</button>,
}));

vi.mock("@/features/units/components/unit-share-action", () => ({
	UnitShareAction: () => <button type="button">Share</button>,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: { tags: { unnamedTag: "Unnamed Tag" }, ui: { edit: "Edit" } },
	}),
}));

import { TagDetailHero } from "./tag-detail-hero";

const TagId = "00000000-0000-7000-8000-000000000003";
const tag = {
	id: TagId,
	language: "en",
	avatar: null,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
	localizations: [
		{
			unitId: TagId,
			language: "en",
			position: "a0",
			title: "Science",
			summary: "Knowledge built through observation.",
			description: null,
			avatar: null,
			banner: null,
			cover: null,
			createdAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-01T00:00:00.000Z",
		},
	],
	capabilities: { canEdit: true },
} satisfies GetApiTagsByTagIdStatus200;

afterEach(cleanup);

describe("TagDetailHero", () => {
	it("uses the Book-style upper actions and keeps Share out of the reaction bar", () => {
		render(<TagDetailHero tag={tag} />);

		expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(
			`/tags/${TagId}/edit`,
		);
		const discussion = screen.getByRole("link", { name: "Discussion" });
		expect(discussion.getAttribute("href")).toBe(`/tags/${TagId}/discussion`);
		expect(discussion.getAttribute("data-show-share")).toBe("false");
	});
});
