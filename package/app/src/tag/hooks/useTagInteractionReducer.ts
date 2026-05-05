import { useReducer } from "react";

/**
 * Three-state machine for the TagInteraction component.
 *
 * preview           → one chip active; Popper shown
 * selected          → explicit tag selection for search actions
 *
 * Transitions:
 *   no selection + CLICK_CHIP                → preview(chip)
 *   preview + CLICK_CHIP (same)              → idle
 *   preview + CLICK_CHIP (other)             → selected({prev, other})
 *   selected + CLICK_CHIP                    → toggle membership
 *   SELECT_CHIPS                             → selected(chips)
 *   CLOSE_PREVIEW                            → clear only preview
 *   DESELECT_ALL                             → idle
 */

export type TagInteractionState = {
  preview: { tagUnitId: string; anchor: HTMLElement } | null;
  selected: string[];
};

export type TagInteractionAction =
  | { type: "CLICK_CHIP"; tagUnitId: string; anchor: HTMLElement }
  | { type: "SELECT_CHIPS"; tagUnitIds: string[] }
  | { type: "CLOSE_PREVIEW" }
  | { type: "DESELECT_ALL" };

export function tagInteractionReducer(
  state: TagInteractionState,
  action: TagInteractionAction,
): TagInteractionState {
  switch (action.type) {
    case "CLICK_CHIP": {
      if (state.selected.length > 0) {
        const exists = state.selected.includes(action.tagUnitId);
        const selected = exists
          ? state.selected.filter((id) => id !== action.tagUnitId)
          : [...state.selected, action.tagUnitId];
        return { preview: null, selected };
      }

      if (!state.preview) {
        return {
          preview: { tagUnitId: action.tagUnitId, anchor: action.anchor },
          selected: [],
        };
      }

      if (state.preview.tagUnitId === action.tagUnitId) {
        return {
          preview: null,
          selected: [],
        };
      }

      return {
        preview: null,
        selected: [state.preview.tagUnitId, action.tagUnitId],
      };
    }
    case "SELECT_CHIPS":
      return {
        preview: null,
        selected: Array.from(new Set(action.tagUnitIds)),
      };
    case "CLOSE_PREVIEW":
      return { ...state, preview: null };
    case "DESELECT_ALL":
      return { preview: null, selected: [] };
    default:
      return state;
  }
}

export function useTagInteractionReducer() {
  return useReducer(tagInteractionReducer, { preview: null, selected: [] });
}
