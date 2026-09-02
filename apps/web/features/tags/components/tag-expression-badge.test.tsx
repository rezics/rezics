/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return { ...actual, getApiTagsByTagIdPaths: vi.fn() };
});

vi.mock("@rezics/ui", () => {
	const Container = ({ children }: { readonly children: ReactNode }) => <>{children}</>;
	return {
		Badge: ({ children }: { readonly children: ReactNode }) => <span>{children}</span>,
		Button: Container,
		Popover: Container,
		PopoverBody: Container,
		PopoverClose: Container,
		PopoverContent: () => null,
		PopoverDescription: Container,
		PopoverHeader: Container,
		PopoverTitle: Container,
		PopoverTrigger: Container,
	};
});

vi.mock("@tanstack/react-query", () => ({
	useInfiniteQuery: () => ({
		data: undefined,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
	}),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
		<a href={href}>{children}</a>
	),
}));
vi.mock("@/features/profiles/profile-route", () => ({
	profileHref: (profileId: string) => `/profiles/${profileId}`,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				card: { details: "Details", search: "Search" },
				expressions: {
					applicationCount: ({ count }: { readonly count: number }) => `${count} sources`,
					applicationsTitle: "Sources",
					close: "Close",
					directApplication: "Direct",
					open: ({
						authority,
						expression,
					}: {
						readonly authority: string;
						readonly expression: string;
					}) => `Open ${expression} in ${authority}`,
					otherPositionsDescription: "Other positions",
					otherPositionsTitle: "Other positions",
					pathApplication: "Path",
					relationFallback: "Relation",
					relations: { generic: "Kind" },
					removeApplication: "Remove",
					showCompletePath: "Show complete Path",
					sourceContributor: "Contributor",
					sourceDate: ({ date }: { readonly date: string }) => date,
				},
				paths: {
					details: "Path details",
					memberFallback: "Unknown member",
					pathLabel: "Path",
					spoilerSummary: () => "Spoilers",
				},
				unnamedTag: "Unknown Tag",
			},
			ui: { showMore: "Show more" },
		},
	}),
}));
vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));
vi.mock("./tag-path", () => ({ TagPathPath: () => null }));
vi.mock("./tag-vote-controls", () => ({ TagVoteControls: () => null }));

import { TagExpressionBadge, type UnitRenderedExpression } from "./tag-expression-badge";

const item = {
	key: "global:hair-curtained",
	authority: { kind: "global" },
	expressionId: "hair-curtained",
	focusTagId: "curtained",
	label: "Hair · Curtained",
	labelComponents: [
		{
			tagId: "hair",
			semanticRole: "slot",
			componentKind: "required",
			title: "Hair",
		},
		{
			tagId: "curtained",
			semanticRole: "value",
			componentKind: "required",
			title: "Curtained",
		},
	],
	applications: [
		{
			applicationId: "application-1",
			sourceKind: "path",
			authority: { kind: "global" },
			senseId: "sense-1",
			pathId: "path-1",
			tagId: null,
			expressionId: "hair-curtained",
			createdByProfileId: null,
			members: ["Hair", "Hairstyle", "Bangs", "Curtained"].map((title, ordinal) => ({
				ordinal,
				nodeId: `node-${ordinal}`,
				nodeKind: "concept" as const,
				incomingRelation:
					ordinal === 0
						? null
						: { relationId: `relation-${ordinal}`, relationKind: "generic" as const },
				language: "en",
				title,
				summary: null,
				avatar: null,
			})),
			score: 1,
			voteCount: 1,
			spoilerVoteCount: 0,
			spoilerDistribution: { none: 0, minor: 0, major: 0 },
			viewerVote: null,
			viewerSpoilerLevel: null,
			createdAt: "2026-09-02T11:12:42.778Z",
		},
	],
	collisionRepair: "none",
} satisfies UnitRenderedExpression;

afterEach(cleanup);

describe("TagExpressionBadge Path presentation", () => {
	it("uses the full Path for its accessible name and responsive compact trails", () => {
		const { container } = render(
			<TagExpressionBadge
				authorityLabel="Global"
				canCurate={false}
				canVote={false}
				isPending={() => false}
				item={item}
				onClearJudgment={() => undefined}
				onRemoveApplication={() => undefined}
				onSpoilerChange={() => undefined}
				onVote={() => undefined}
				presentation="path"
				type="book"
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Open Hair › Hairstyle › Bangs › Curtained in Global",
			}),
		).toBeTruthy();
		expect(container.querySelector(".sm\\:hidden")?.textContent).toBe("Hair›…›Curtained");
		expect(container.querySelector(".sm\\:inline-flex")?.textContent).toBe(
			"Hair›Hairstyle›Bangs›Curtained",
		);
	});
});
