/** @vitest-environment jsdom */

import type { PortableTextValue } from "@rezics/portable-text";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubjectPostComposer } from "./subject-post-composer";

const { excerptBody, invalidatePostQueries, mutateAsync } = vi.hoisted(() => ({
	excerptBody: [
		{
			_key: "excerpt-block",
			_type: "block",
			children: [
				{
					_key: "excerpt-span",
					_type: "span",
					marks: [],
					text: "Selected passage",
				},
			],
			markDefs: [],
			style: "normal",
		},
	] satisfies PortableTextValue,
	invalidatePostQueries: vi.fn(async () => undefined),
	mutateAsync: vi.fn(async () => ({ id: "excerpt-1" })),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	usePostApiPosts: () => ({
		error: null,
		isPending: false,
		mutateAsync,
	}),
}));

vi.mock("@rezics/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/ui")>()),
	UnitMultiPicker: () => <div data-testid="realm-picker" />,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQueryClient: () => ({}),
}));

vi.mock("@/features/editor/portable-text-editor", () => ({
	PortableTextEditor: ({
		label,
		onChange,
	}: {
		label: string;
		onChange: (value: PortableTextValue) => void;
	}) => (
		<div>
			<span>{label}</span>
			<button onClick={() => onChange(excerptBody)} type="button">
				Enter excerpt body
			</button>
		</div>
	),
	preloadPortableTextEditor: vi.fn(),
}));

vi.mock("@/features/realms/components/realm-rules-acknowledgement-prompt", () => ({
	RealmRulesAcknowledgementPrompt: () => null,
}));

vi.mock("@/features/realms/hooks/use-realm-rules-acknowledgement", () => ({
	useRealmRulesAcknowledgement: () => ({
		run: async <Result,>(operation: () => Promise<Result>) => operation(),
	}),
}));

vi.mock("@/features/content-languages/components/draft-content-language-field", () => ({
	DraftContentLanguageField: () => null,
}));

vi.mock("@/features/content-languages/hooks/use-form-draft-content-language", () => ({
	useFormDraftContentLanguage: () => ({
		controller: {},
		onInput: vi.fn(),
		reset: vi.fn(),
		resolveLanguage: async () => "en",
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { target: "en" },
		t: {
			errors: { invalid: "Invalid" },
			posts: {
				cancel: "Cancel",
				openDiscussionComposer: "Start a discussion",
				openExcerptComposer: "Add an excerpt",
				publish: "Publish",
				publishRealms: "Publish Realms",
				publishRealmsHint: "Realm hint",
				publishRealmsLimit: "Realm limit",
				removePublishRealm: "Remove Realm",
				summaryOptional: "Summary (optional)",
				titleOptional: "Title (optional)",
			},
			ui: { body: "Body", retryLater: "Retry later" },
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({
	RequestFailure: () => null,
}));

vi.mock("./query", () => ({
	invalidatePostQueries,
}));

afterEach(() => {
	cleanup();
	mutateAsync.mockClear();
	invalidatePostQueries.mockClear();
});

describe("SubjectPostComposer", () => {
	it("expands the complete editor and publishes an Excerpt for the fixed subject", async () => {
		render(
			<SubjectPostComposer
				postKind="excerpt"
				subjectId="019b76da-a800-7300-8000-000000000002"
			/>,
		);

		const trigger = screen.getByRole("button", { name: "Add an excerpt" });

		fireEvent.click(trigger);

		expect(screen.queryByRole("button", { name: "Add an excerpt" })).toBeNull();
		expect(screen.getByText("Title (optional)")).toBeDefined();
		expect(screen.getByText("Summary (optional)")).toBeDefined();
		expect(screen.getByTestId("realm-picker")).toBeDefined();
		expect(screen.getByText("Body")).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Enter excerpt body" }));
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));

		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				body: expect.objectContaining({
					postKind: "excerpt",
					publishRealmIds: [],
					subjectId: "019b76da-a800-7300-8000-000000000002",
				}),
			}),
		);
		expect(invalidatePostQueries).toHaveBeenCalledWith({}, "excerpt-1");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Add an excerpt" })).toBeDefined(),
		);
	});
});
