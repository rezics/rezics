/** @vitest-environment jsdom */

import type { PortableTextValue } from "@rezics/portable-text";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewComposer } from "./review-composer";

const { body, invalidateReviews, mutateAsync } = vi.hoisted(() => ({
	body: [
		{
			_key: "review-block",
			_type: "block",
			children: [
				{
					_key: "review-span",
					_type: "span",
					marks: [],
					text: "A detailed review body",
				},
			],
			markDefs: [],
			style: "normal",
		},
	] satisfies PortableTextValue,
	invalidateReviews: vi.fn(async () => undefined),
	mutateAsync: vi.fn(async () => ({ id: "review-1" })),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	usePostApiReviews: () => ({
		error: null,
		isPending: false,
		mutateAsync,
	}),
}));

vi.mock("@rezics/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/ui")>()),
	EntityPicker: ({ onChange }: { onChange: (value: { id: string; label: string }) => void }) => (
		<button onClick={() => onChange({ id: "score-realm", label: "Score Realm" })} type="button">
			Choose score Realm
		</button>
	),
	UnitMultiPicker: ({
		onValuesChange,
	}: {
		onValuesChange: (values: readonly string[]) => void;
	}) => (
		<button onClick={() => onValuesChange(["publish-a", "publish-b"])} type="button">
			Choose publication Realms
		</button>
	),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQueryClient: () => ({}),
}));

vi.mock("@/features/content-languages/components/draft-content-language-field", () => ({
	DraftContentLanguageField: () => null,
}));

vi.mock("@/features/content-languages/hooks/use-form-draft-content-language", () => ({
	useFormDraftContentLanguage: () => ({
		controller: {},
		onInput: vi.fn(),
		reset: vi.fn(),
		resolveLanguage: async () => "fr",
	}),
}));

vi.mock("@/features/editor/portable-text-editor", () => ({
	PortableTextEditor: ({ onChange }: { onChange: (value: PortableTextValue) => void }) => (
		<button onClick={() => onChange(body)} type="button">
			Enter review body
		</button>
	),
}));

vi.mock("@/features/realms/components/realm-rules-acknowledgement-prompt", () => ({
	RealmRulesAcknowledgementPrompt: () => null,
}));

vi.mock("@/features/realms/hooks/use-realm-rules-acknowledgement", () => ({
	useRealmRulesAcknowledgement: () => ({
		run: async <Result,>(operation: () => Promise<Result>) => operation(),
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			engagement: {
				reviewTarget: "Review target",
				scoreRealm: "Scoring Realm",
				reviewScoreRealmHint: "Score Realm hint",
			},
			errors: { invalid: "Invalid" },
			posts: {
				publishRealms: "Publish Realms",
				publishRealmsHint: "Publication hint.",
				publishRealmsLimit: "Publication limit.",
				removePublishRealm: "Remove Realm",
				summaryOptional: "Summary (optional)",
				titleOptional: "Title (optional)",
			},
			ui: {
				body: "Body",
				create: "Create",
				pickerPlaceholders: {
					realm: "Enter a Realm name",
					unit: "Enter a name or title",
				},
				retryLater: "Retry later",
			},
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({
	RequestFailure: () => null,
}));

vi.mock("../data/default-score-realm", () => ({
	useDefaultScoreRealm: () => ({ error: null, realm: undefined }),
}));

vi.mock("../data/review-cache", () => ({
	invalidateReviews,
}));

vi.mock("./score-input", () => ({
	ScoreInput: ({ onChange }: { onChange: (value: number) => void }) => (
		<button onClick={() => onChange(8)} type="button">
			Choose score
		</button>
	),
}));

afterEach(() => {
	cleanup();
	mutateAsync.mockClear();
	invalidateReviews.mockClear();
});

describe("ReviewComposer", () => {
	it("keeps publication Realms separate from the scoring Realm", async () => {
		render(
			<ReviewComposer
				onCreated={vi.fn()}
				target={{ id: "review-target", label: "Review target" }}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Choose publication Realms" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose score Realm" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose score" }));
		fireEvent.click(screen.getByRole("button", { name: "Enter review body" }));
		fireEvent.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				body: expect.objectContaining({
					language: "fr",
					publishRealmIds: ["publish-a", "publish-b"],
					score: { realmId: "score-realm", value: 8 },
					targetId: "review-target",
				}),
			}),
		);
		expect(invalidateReviews).toHaveBeenCalledWith(
			{},
			"review-1",
			"review-target",
			"score-realm",
		);
	});
});
