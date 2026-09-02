/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GetApiTagsSuggestionsStatus200 } from "@rezics/openapi-tanstack-query";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	collection: { items: [] as Array<{ selectionKey: string }> },
	inputValueChange: undefined as ((details: { readonly inputValue: string }) => void) | undefined,
	suggestions: vi.fn(),
	valueChange: undefined as ((details: { readonly value: string[] }) => void) | undefined,
}));

vi.mock("@ark-ui/react", () => ({
	useListCollection: () => ({
		collection: mocks.collection,
		set: (items: Array<{ selectionKey: string }>) => {
			mocks.collection.items = items;
		},
	}),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: { Tags: "tags" },
	getApiTagsSuggestions: mocks.suggestions,
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
				expressions: {
					directApplication: "Direct Tag",
					pathApplication: "Tag Path",
				},
				card: { details: "View Tag details" },
				picker: {
					open: ({ tag }: { readonly tag: string }) => `Review ${tag}`,
					close: "Close Tag details",
					path: "Tag Path",
					remove: ({ tag }: { readonly tag: string }) => `Remove ${tag}`,
					searchMore: "Search for another Tag",
					loading: "Searching Tags",
					searchError: "Search failed",
					directResults: "Tags",
					pathResults: "Tag Paths",
					noResults: "No results",
					addSelected: ({ count }: { readonly count: number }) => `Add selected Tags (${count})`,
					selectedCount: ({ count }: { readonly count: number }) => `${count} pending selections`,
					commitError: "Add failed",
				},
			},
			ui: {},
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({ RequestFailure: () => null }));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

vi.mock("@rezics/ui", () => {
	const container = ({ children }: { readonly children: ReactNode }) => <div>{children}</div>;
	return {
		Badge: container,
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
		Combobox: ({
			children,
			onInputValueChange,
			onValueChange,
		}: {
			readonly children: ReactNode;
			readonly onInputValueChange: (details: { readonly inputValue: string }) => void;
			readonly onValueChange: (details: { readonly value: string[] }) => void;
		}) => {
			mocks.inputValueChange = onInputValueChange;
			mocks.valueChange = onValueChange;
			return <div>{children}</div>;
		},
		ComboboxContent: container,
		ComboboxEmpty: container,
		ComboboxGroup: container,
		ComboboxInput: container,
		ComboboxItem: container,
		ComboboxList: container,
		Popover: container,
		PopoverBody: container,
		PopoverClose: container,
		PopoverContent: container,
		PopoverDescription: container,
		PopoverHeader: container,
		PopoverTitle: container,
		PopoverTrigger: container,
	};
});

import { TagSelectionMultiPicker } from "./tag-selection-multi-picker";
import type { TagSelectionOption } from "../model/tag-suggestion";

const TagId = "019fb1ef-a9b2-7a98-8d45-770b04760101";
const PathTagId = "019fb1ef-a9b2-7a98-8d45-770b04760102";
const ExpressionId = "019fb1ef-a9b2-7a98-8d45-770b04760103";
const PathExpressionId = "019fb1ef-a9b2-7a98-8d45-770b04760104";
const PathId = "019fb1ef-a9b2-7a98-8d45-770b04760105";
const SenseId = "019fb1ef-a9b2-7a98-8d45-770b04760106";
const DirectKey = `expression:${ExpressionId}`;
const PathKey = `sense:${SenseId}`;

function suggestions(): GetApiTagsSuggestionsStatus200 {
	return {
		items: [
			{
				selection: "direct_expression",
				selectionKey: DirectKey,
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
			{
				selection: "path_sense",
				selectionKey: PathKey,
				expression: {
					expressionId: PathExpressionId,
					expressionKind: "facet_value",
					focusTagId: PathTagId,
					presentationRevision: 1,
					components: [
						{
							tagId: PathTagId,
							semanticRole: "focus",
							componentKind: "required",
							language: "en",
							title: "White",
						},
					],
					groupKey: null,
				},
				senseId: SenseId,
				pathId: PathId,
				members: [
					{
						ordinal: 0,
						nodeId: TagId,
						nodeKind: "concept",
						incomingRelation: null,
						language: "en",
						title: "Hair",
						summary: null,
						avatar: null,
					},
					{
						ordinal: 1,
						nodeId: PathTagId,
						nodeKind: "concept",
						incomingRelation: {
							relationId: "019fb1ef-a9b2-7a98-8d45-770b04760107",
							relationKind: "facet_value",
						},
						language: "en",
						title: "White",
						summary: null,
						avatar: null,
					},
				],
				usageCount: 4,
				match: { kind: "exact", source: "path_member", tagId: TagId },
			},
		],
	};
}

async function search(query: string) {
	act(() => mocks.inputValueChange?.({ inputValue: query }));
	await act(async () => {
		await vi.advanceTimersByTimeAsync(250);
	});
}

describe("TagSelectionMultiPicker", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mocks.collection.items = [];
		mocks.suggestions.mockReset();
		mocks.suggestions.mockResolvedValue({ data: suggestions() });
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("keeps multiple semantic choices as removable badges and commits them together", async () => {
		const onCommit = vi.fn(async (_selections: readonly TagSelectionOption[]) => [
			{ selectionKey: DirectKey, status: "added" as const },
			{ selectionKey: PathKey, status: "added" as const },
		]);
		render(
			<TagSelectionMultiPicker
				actionLabel="Add Tags"
				ariaLabel="Add Tags"
				onCommit={onCommit}
				placeholder="Search Tags"
			/>,
		);

		await search("Hair");
		act(() => mocks.valueChange?.({ value: [DirectKey] }));
		act(() => mocks.valueChange?.({ value: [DirectKey, PathKey] }));

		expect(screen.getByRole("button", { name: "Remove Hair" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Remove White" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Add selected Tags (2)" }));
		await act(async () => undefined);

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit.mock.calls[0]?.[0]).toEqual([
			expect.objectContaining({ selectionKey: DirectKey, kind: "direct_expression" }),
			expect.objectContaining({ selectionKey: PathKey, kind: "path_sense", senseId: SenseId }),
		]);
	});
});
