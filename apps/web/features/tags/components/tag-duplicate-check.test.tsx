/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GetApiTagsSuggestionsStatus200 } from "@rezics/openapi-tanstack-query";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ suggestions: vi.fn() }));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: { Tags: "tags" },
	getApiTagsSuggestions: state.suggestions,
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				unnamedTag: "Unnamed Tag",
				paths: { memberFallback: "Unnamed member" },
				create: {
					duplicateTitle: "Check existing Tags",
					duplicateDescription: "Reuse an existing Tag.",
					duplicateSearching: "Checking existing Tags",
					duplicateSearchError: "Search failed",
					duplicateMatches: "Possible matches",
					duplicateNoMatches: "No matches",
					useExisting: "Use this Tag",
					viewExisting: "View Tag",
					exactDuplicateBlocked: "An exact Tag already exists.",
					duplicateConfirmed: "Checked",
					continueDistinct: "None match; create a new Tag",
					useExistingError: "Apply failed",
				},
			},
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({ RequestFailure: () => null }));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@rezics/ui", () => ({
	Alert: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	AlertDescription: ({ children }: { readonly children: ReactNode }) => <p>{children}</p>,
	Button: ({
		asChild,
		children,
		disabled,
		onClick,
	}: {
		readonly asChild?: boolean;
		readonly children: ReactNode;
		readonly disabled?: boolean;
		readonly onClick?: () => void;
	}) =>
		asChild ? (
			children
		) : (
			<button disabled={disabled} onClick={onClick}>
				{children}
			</button>
		),
}));

import { TagDuplicateCheck } from "./tag-duplicate-check";

const TagId = "019fb1ef-a9b2-7a98-8d45-770b04760101";
const ExpressionId = "019fb1ef-a9b2-7a98-8d45-770b04760102";

function exactHairResponse(): GetApiTagsSuggestionsStatus200 {
	return {
		items: [
			{
				selection: "direct_expression",
				selectionKey: `expression:${ExpressionId}`,
				expression: {
					expressionId: ExpressionId,
					expressionKind: "simple",
					focusTagId: TagId,
					presentationRevision: 1,
					components: [
						{
							tagId: TagId,
							semanticRole: "focus",
							componentKind: "required",
							language: "en",
							title: "Hair",
						},
					],
					groupKey: null,
				},
				senseId: null,
				pathId: null,
				members: [],
				usageCount: 0,
				match: { kind: "exact", source: "direct_tag", tagId: TagId },
			},
		],
	};
}

async function finishDebounce() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250);
	});
}

describe("TagDuplicateCheck", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		state.suggestions.mockReset();
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("searches automatically and blocks an exact duplicate", async () => {
		state.suggestions.mockResolvedValue({ data: exactHairResponse() });
		render(
			<TagDuplicateCheck
				confirmed={false}
				onConfirmedChange={vi.fn()}
				onUseExisting={vi.fn(async () => undefined)}
				title="Hair"
			/>,
		);

		await finishDebounce();
		expect(state.suggestions).toHaveBeenCalledWith(
			expect.objectContaining({ query: { q: "Hair", limit: 20, localizationLanguages: ["en"] } }),
		);
		expect(screen.getByText("An exact Tag already exists.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Use this Tag" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "None match; create a new Tag" })).toBeNull();
	});

	it("allows an explicit distinct confirmation after a successful empty search", async () => {
		state.suggestions.mockResolvedValue({ data: { items: [] } });
		const onConfirmedChange = vi.fn();
		render(
			<TagDuplicateCheck
				confirmed={false}
				onConfirmedChange={onConfirmedChange}
				title="New concept"
			/>,
		);

		await finishDebounce();
		fireEvent.click(screen.getByRole("button", { name: "None match; create a new Tag" }));
		expect(onConfirmedChange).toHaveBeenCalledWith(true);
	});
});
