export interface TagSelectionState {
	readonly mode: "idle" | "selecting";
	readonly selectedTagIds: readonly string[];
}

export type TagSelectionAction =
	| { readonly type: "enter"; readonly tagId?: string }
	| { readonly type: "toggle"; readonly tagId: string }
	| { readonly type: "clear" }
	| { readonly type: "exit" };

export const InitialTagSelectionState: TagSelectionState = {
	mode: "idle",
	selectedTagIds: [],
};

export function tagSelectionReducer(
	state: TagSelectionState,
	action: TagSelectionAction,
): TagSelectionState {
	switch (action.type) {
		case "enter":
			return {
				mode: "selecting",
				selectedTagIds: action.tagId ? [action.tagId] : [],
			};
		case "toggle": {
			const selected = new Set(state.selectedTagIds);
			if (selected.has(action.tagId)) selected.delete(action.tagId);
			else selected.add(action.tagId);
			return { mode: "selecting", selectedTagIds: [...selected] };
		}
		case "clear":
			return { ...state, selectedTagIds: [] };
		case "exit":
			return InitialTagSelectionState;
	}
}

export function isModifiedLinkActivation(input: {
	readonly altKey: boolean;
	readonly button: number;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly shiftKey: boolean;
}): boolean {
	return input.button !== 0 || input.altKey || input.ctrlKey || input.metaKey || input.shiftKey;
}
