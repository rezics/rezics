// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => {
	const Block = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Alert: Block,
		AlertDescription: Block,
		AlertTitle: Block,
		HoverCard: Block,
		HoverCardContent: Block,
		HoverCardTrigger: Block,
	};
});

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
				confirmedDescription: "Search confirmed.",
				confirmedTitle: ({ subject }: { readonly subject: string }) =>
					`Existing ${subject} searched`,
				policy: "Search before creating a public entry.",
				prompt: ({ subject }: { readonly subject: string }) => `Search existing ${subject}`,
				requiredDescription: "Search is required.",
				requiredTitle: "Check existing entries first",
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

import { entityCommunityUnitSearchSubject } from "@/features/create/model/community-unit-search";
import { CommunityUnitSearchPrompt } from "./community-unit-search-prompt";

describe("CommunityUnitSearchPrompt", () => {
	it("makes the exact Entity search prompt a link with the policy in its hover card", () => {
		render(
			<CommunityUnitSearchPrompt
				confirmed={false}
				query="OpenAI"
				subject={entityCommunityUnitSearchSubject("organization")}
			/>,
		);

		expect(
			screen
				.getByRole("link", { name: "Search existing organizations" })
				.getAttribute("href"),
		).toBe("/create/entity/search?kind=organization&q=OpenAI");
		expect(screen.getByText("Search before creating a public entry.")).toBeTruthy();
		expect(screen.getByText("Search is required.")).toBeTruthy();
	});
});
