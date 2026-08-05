/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { CommunityScoreOverview } from "./community-score-overview";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		Rating: () => <span data-testid="rating" />,
	};
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiScoresByTargetId: () => ({
		data: {
			distribution: { "7": 1, "8": 1 },
			totalCount: 2,
			totalScore: 15,
		},
		error: null,
	}),
}));

vi.mock("@/features/realms/components/realm-score-context-link", () => ({
	RealmScoreContextLink: () => null,
}));

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("CommunityScoreOverview", () => {
	it("exposes every Score as an independent pressed filter control", async () => {
		const onScoreFilterToggle = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<CommunityScoreOverview
					realmId="019b76da-a800-7300-8000-000000000002"
					onScoreFilterToggle={onScoreFilterToggle}
					reviewCount={{ kind: "exact", value: 2 }}
					selectedScores={[8]}
					targetId="019f92b9-cb0d-7cb6-a55a-1d5ecedc0949"
				/>
			</TranslationProvider>,
		);

		const scoreSeven = await screen.findByRole("button", {
			name: "評為 7 分 1 筆（50%）",
		});
		const scoreEight = screen.getByRole("button", {
			name: "評為 8 分 1 筆（50%）",
		});
		expect(scoreSeven.getAttribute("aria-pressed")).toBe("false");
		expect(scoreEight.getAttribute("aria-pressed")).toBe("true");

		fireEvent.click(scoreSeven);
		fireEvent.click(scoreEight);

		expect(onScoreFilterToggle.mock.calls).toEqual([[7], [8]]);
	});
});
