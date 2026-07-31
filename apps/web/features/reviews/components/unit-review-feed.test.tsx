/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnitReviewFeed } from "./unit-review-feed";

const defaultRealm = {
	id: "default-score-realm",
	label: "Realm Score",
};

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiReviews: () => ({
		data: { totalCount: 0 },
		error: null,
		isError: false,
	}),
}));

vi.mock("@rezics/filter", () => ({
	combineUnitPredicates: () => undefined,
}));

vi.mock("nuqs", () => ({
	useQueryStates: () => [
		{
			languages: [],
			q: "",
			realms: [],
			scoreRealm: null,
			scores: [],
			sort: "best",
			tags: [],
		},
		vi.fn(),
	],
}));

vi.mock("@/features/content-feed/data/api-feed-list", () => ({
	ApiFeedList: () => null,
}));

vi.mock("@/features/content-feed/model/subject-feed-filter", () => ({
	createSubjectFeedPredicate: () => undefined,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { current: "zh-Hant" },
		t: {
			engagement: {
				scoreRealm: "評分領域",
			},
		},
	}),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh-Hant"],
}));

vi.mock("../data/default-score-realm", () => ({
	useDefaultScoreRealm: () => ({ error: null, realm: defaultRealm }),
}));

vi.mock("../model/unit-review-feed-filter", () => ({
	createReviewScorePredicate: () => undefined,
}));

vi.mock("../routing/review-feed-search-params", () => ({
	reviewFeedHref: () => "/reviews",
	reviewFeedSearchParams: {},
}));

vi.mock("./community-score-overview", () => ({
	CommunityScoreOverview: () => null,
}));

vi.mock("./score-realm-picker", () => ({
	ScoreRealmPicker: ({ value }: { value?: { label: string } }) => (
		<span data-testid="score-realm-picker">{value?.label}</span>
	),
}));

vi.mock("@/features/realms/components/realm-score-context-link", () => ({
	RealmScoreContextLink: ({ realmId }: { realmId: string }) => (
		<span data-testid="score-guidelines">{realmId}</span>
	),
}));

afterEach(cleanup);

describe("UnitReviewFeed", () => {
	it("keeps the visible picker and guidelines entry on the resolved default Realm", () => {
		render(<UnitReviewFeed mode="page" targetId="target-id" />);

		expect(screen.getByTestId("score-realm-picker").textContent).toBe("Realm Score");
		expect(screen.getByTestId("score-guidelines").textContent).toBe("default-score-realm");
	});
});
