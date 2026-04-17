import { useReducer } from "react";

/**
 * Three-state machine for the TagInteraction component.
 *
 * idle              → no chip active
 * single-preview    → one chip active; Popper shown
 * multi-select      → 2+ chips selected; action bar shown
 *
 * Transitions:
 *   idle + CLICK_CHIP           → single-preview(chip)
 *   single-preview + CLICK_CHIP (same) → idle
 *   single-preview + CLICK_CHIP (other) → multi-select({prev, other})
 *   single-preview + CLOSE_POPPER → idle
 *   multi-select + CLICK_CHIP   → toggle membership (→ idle when empty)
 *   multi-select + DESELECT_ALL → idle
 */

export type TagInteractionState =
  | { kind: "idle" }
  | { kind: "single-preview"; tagUnitId: string; anchor: HTMLElement }
  | { kind: "multi-select"; selected: string[] };

export type TagInteractionAction =
  | { type: "CLICK_CHIP"; tagUnitId: string; anchor: HTMLElement }
  | { type: "CLOSE_POPPER" }
  | { type: "DESELECT_ALL" };

function reducer(
  state: TagInteractionState,
  action: TagInteractionAction,
): TagInteractionState {
  switch (action.type) {
    case "CLICK_CHIP": {
      if (state.kind === "idle") {
        return {
          kind: "single-preview",
          tagUnitId: action.tagUnitId,
          anchor: action.anchor,
        };
      }
      if (state.kind === "single-preview") {
        if (state.tagUnitId === action.tagUnitId) {
          return { kind: "idle" };
        }
        return {
          kind: "multi-select",
          selected: [state.tagUnitId, action.tagUnitId],
        };
      }
      // multi-select: toggle
      const exists = state.selected.includes(action.tagUnitId);
      const next = exists
        ? state.selected.filter((id) => id !== action.tagUnitId)
        : [...state.selected, action.tagUnitId];
      if (next.length === 0) return { kind: "idle" };
      return { kind: "multi-select", selected: next };
    }
    case "CLOSE_POPPER":
      if (state.kind === "single-preview") return { kind: "idle" };
      return state;
    case "DESELECT_ALL":
      return { kind: "idle" };
    default:
      return state;
  }
}

export function useTagInteractionReducer() {
  return useReducer(reducer, { kind: "idle" });
}
