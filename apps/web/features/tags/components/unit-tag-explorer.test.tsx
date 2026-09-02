/** @vitest-environment jsdom */

import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	badgeCalls: [] as Array<{
		readonly authorityPrefix?: string;
		readonly label: string;
		readonly presentation?: "label" | "path";
	}>,
}));

const tagData = {
	expressions: [
		{
			authority: { kind: "global" },
			expression: {
				expressionId: "01941f29-7c00-7086-a376-05f25453dee2",
				expressionKind: "facet_value",
				focusTagId: "01941f29-7c00-7d30-b36a-1ea7d1554bb6",
				presentationRevision: 1,
				components: [
					{
						tagId: "01941f29-7c00-73bd-ad49-663392107c3e",
						semanticRole: "slot",
						componentKind: "required",
						language: "en",
						title: "Hair",
					},
					{
						tagId: "01941f29-7c00-7d30-b36a-1ea7d1554bb6",
						semanticRole: "value",
						componentKind: "required",
						language: "en",
						title: "Curtained",
					},
				],
				groupKey: {
					tagId: "01941f29-7c00-73bd-ad49-663392107c3e",
					semanticRole: "slot",
					language: "en",
					title: "Hair",
				},
			},
			applications: [
				{
					applicationId: "01a061d2-3c88-7410-84e2-1cd1f1988def",
					sourceKind: "path",
					authority: { kind: "global" },
					senseId: "01941f29-7c00-7037-ab89-88a49e69b764",
					pathId: "01941f29-7c00-70f3-9611-b100df5160b3",
					tagId: null,
					expressionId: "01941f29-7c00-7086-a376-05f25453dee2",
					createdByProfileId: null,
					members: [
						{
							ordinal: 0,
							nodeId: "01941f29-7c00-73bd-ad49-663392107c3e",
							nodeKind: "concept",
							incomingRelation: null,
							language: "en",
							title: "Hair",
							summary: null,
							avatar: null,
						},
						{
							ordinal: 1,
							nodeId: "01941f29-7c00-7de4-a7a7-1b91b1098e12",
							nodeKind: "concept",
							incomingRelation: {
								relationId: "01941f29-7c00-7078-bc8c-5ced936075de",
								relationKind: "generic",
							},
							language: "en",
							title: "Hairstyle",
							summary: null,
							avatar: null,
						},
						{
							ordinal: 2,
							nodeId: "01941f29-7c00-7d30-b36a-1ea7d1554bb6",
							nodeKind: "concept",
							incomingRelation: {
								relationId: "01941f29-7c00-705d-857c-578438589c64",
								relationKind: "generic",
							},
							language: "en",
							title: "Curtained",
							summary: null,
							avatar: null,
						},
					],
					score: 1,
					voteCount: 1,
					spoilerVoteCount: 0,
					spoilerDistribution: { none: 0, minor: 0, major: 0 },
					viewerVote: null,
					viewerSpoilerLevel: null,
					createdAt: "2026-09-02T11:12:42.778Z",
				},
			],
		},
	],
	totals: { expressions: 1 },
	realms: [],
	voteRealms: [],
} satisfies GetApiUnitsByTypeByUnitIdTagsStatus200;

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	const mutation = () => ({
		error: null,
		isPending: false,
		mutate: vi.fn(),
		mutateAsync: vi.fn(async () => undefined),
		variables: undefined,
	});
	return {
		...actual,
		getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey: vi.fn(() => []),
		getApiUnitsByTypeByUnitIdTagsQueryKey: vi.fn(() => []),
		useDeleteApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationId: mutation,
		useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote: mutation,
		useDeleteApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationId: mutation,
		useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote: mutation,
		useGetApiRealmsByRealmIdUnitsByUnitIdTags: () => ({
			data: undefined,
			error: null,
			isError: false,
			isPending: false,
			refetch: vi.fn(),
		}),
		useGetApiUnitsByTypeByUnitId: () => ({ data: undefined }),
		useGetApiUnitsByTypeByUnitIdTags: () => ({
			data: tagData,
			error: null,
			isError: false,
			isPending: false,
			refetch: vi.fn(),
		}),
		usePostApiRealmsByRealmIdUnitsByUnitIdTagPathApplications: mutation,
		usePostApiUnitsByTypeByUnitIdTagPathApplications: mutation,
		usePutApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationIdJudgment: mutation,
		usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote: mutation,
		usePutApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationIdJudgment: mutation,
		usePutApiUnitsByTypeByUnitIdTagsByTagId: mutation,
		usePutApiUnitsByTypeByUnitIdTagsByTagIdVote: mutation,
	};
});

vi.mock("@rezics/ui", () => ({
	Button: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
	QueryFailure: () => null,
	QueryPending: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
		<a href={href}>{children}</a>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				expressions: {
					authoritySection: ({ authority }: { readonly authority: string }) => authority,
					description: "Grouped explanation",
					empty: "No Tags",
					relationFallback: "Relation",
					relations: { generic: "Kind" },
					title: "Applied Tag meanings",
				},
				global: { title: "Global" },
				page: {
					more: ({ count }: { readonly count: number }) => `${count} more`,
					title: "Tags",
					viewAll: "View full Tag page",
				},
				realms: { description: "Realm Tags", empty: "No Realm Tags", title: "Realms" },
				unnamedRealm: "Unnamed Realm",
				unnamedTag: "Unnamed Tag",
			},
			ui: { retryLater: "Try again" },
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({ RequestFailure: () => null }));
vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));
vi.mock("@/lib/use-hydrated-session", () => ({ useHydratedSession: () => ({ data: null }) }));

vi.mock("./realm-tag-context-heading", () => ({ RealmTagContextHeading: () => null }));
vi.mock("./tag-context-section", () => ({ TagContextSection: () => null }));
vi.mock("./tag-expression-badge", () => ({
	TagExpressionBadge: ({
		authorityPrefix,
		item,
		presentation,
	}: {
		readonly authorityPrefix?: string;
		readonly item: { readonly label: string };
		readonly presentation?: "label" | "path";
	}) => {
		state.badgeCalls.push({ authorityPrefix, label: item.label, presentation });
		return <button type="button">{item.label}</button>;
	},
}));
vi.mock("./tag-vote-context-selector", () => ({ TagVoteContextSelector: () => null }));
vi.mock("./unit-tag-management", () => ({ UnitTagManagement: () => null }));

import { UnitTagExplorer } from "./unit-tag-explorer";

afterEach(() => {
	cleanup();
	state.badgeCalls.length = 0;
});

describe("UnitTagExplorer expression presentation", () => {
	it("flattens Book summary expressions into Path badges without explanatory groups", () => {
		render(
			<UnitTagExplorer
				expressionPresentation="path-badges"
				surface="section"
				type="book"
				unitId="01941f29-7c00-70cc-86c5-5f5227cc68b9"
			/>,
		);

		expect(screen.getByRole("heading", { name: "Tags" })).toBeTruthy();
		expect(screen.queryByText("Grouped explanation")).toBeNull();
		expect(screen.queryByRole("heading", { name: "Global" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Hair" })).toBeNull();
		expect(state.badgeCalls).toEqual([
			{ authorityPrefix: undefined, label: "Hair · Curtained", presentation: "path" },
		]);
	});

	it("preserves authority and expression groups by default", () => {
		render(
			<UnitTagExplorer
				surface="section"
				type="entity"
				unitId="01941f29-7c00-70cc-86c5-5f5227cc68b9"
			/>,
		);

		expect(screen.getByRole("heading", { name: "Applied Tag meanings" })).toBeTruthy();
		expect(screen.getByText("Grouped explanation")).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Global" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Hair" })).toBeTruthy();
		expect(state.badgeCalls).toEqual([
			{ authorityPrefix: undefined, label: "Curtained", presentation: undefined },
		]);
	});
});
