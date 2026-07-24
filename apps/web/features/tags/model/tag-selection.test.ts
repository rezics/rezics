import { describe, expect, it } from "vitest";

import {
	InitialTagSelectionState,
	isModifiedLinkActivation,
	tagSelectionReducer,
} from "./tag-selection";

describe("tagSelectionReducer", () => {
	it("enters selection with an optional initial Tag", () => {
		expect(
			tagSelectionReducer(InitialTagSelectionState, {
				type: "enter",
				tagId: "tag-a",
			}),
		).toEqual({ mode: "selecting", selectedTagIds: ["tag-a"] });
	});

	it("toggles Tag identity without duplicating it", () => {
		const selected = tagSelectionReducer(
			{ mode: "selecting", selectedTagIds: ["tag-a"] },
			{ type: "toggle", tagId: "tag-b" },
		);
		expect(selected.selectedTagIds).toEqual(["tag-a", "tag-b"]);
		expect(tagSelectionReducer(selected, { type: "toggle", tagId: "tag-a" })).toEqual({
			mode: "selecting",
			selectedTagIds: ["tag-b"],
		});
	});

	it("clears or exits selection explicitly", () => {
		const state = { mode: "selecting" as const, selectedTagIds: ["tag-a"] };
		expect(tagSelectionReducer(state, { type: "clear" })).toEqual({
			mode: "selecting",
			selectedTagIds: [],
		});
		expect(tagSelectionReducer(state, { type: "exit" })).toEqual(InitialTagSelectionState);
	});
});

describe("isModifiedLinkActivation", () => {
	const plain = {
		altKey: false,
		button: 0,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
	};

	it("keeps a plain primary activation for the Tag Card", () => {
		expect(isModifiedLinkActivation(plain)).toBe(false);
	});

	it.each([
		{ ...plain, ctrlKey: true },
		{ ...plain, metaKey: true },
		{ ...plain, shiftKey: true },
		{ ...plain, altKey: true },
		{ ...plain, button: 1 },
	])("preserves native modified-link behavior", (input) => {
		expect(isModifiedLinkActivation(input)).toBe(true);
	});
});
