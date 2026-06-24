import { describe, expect, test } from "bun:test";
import {
  type TagInteractionState,
  tagInteractionReducer,
} from "./useTagInteractionReducer";

const anchor = {} as HTMLElement;

describe("tagInteractionReducer", () => {
  test("opens a preview from idle", () => {
    const state: TagInteractionState = { preview: null, selected: [] };

    expect(
      tagInteractionReducer(state, {
        type: "CLICK_CHIP",
        tagUnitId: "tag-a",
        anchor,
      }),
    ).toEqual({
      preview: { tagUnitId: "tag-a", anchor },
      selected: [],
    });
  });

  test("moves from preview into selection when another chip is clicked", () => {
    const state: TagInteractionState = {
      preview: { tagUnitId: "tag-a", anchor },
      selected: [],
    };

    expect(
      tagInteractionReducer(state, {
        type: "CLICK_CHIP",
        tagUnitId: "tag-b",
        anchor,
      }),
    ).toEqual({
      preview: null,
      selected: ["tag-a", "tag-b"],
    });
  });

  test("toggles selected chips without reopening preview", () => {
    const state: TagInteractionState = {
      preview: null,
      selected: ["tag-a", "tag-b"],
    };

    expect(
      tagInteractionReducer(state, {
        type: "CLICK_CHIP",
        tagUnitId: "tag-c",
        anchor,
      }),
    ).toEqual({
      preview: null,
      selected: ["tag-a", "tag-b", "tag-c"],
    });

    expect(
      tagInteractionReducer(state, {
        type: "CLICK_CHIP",
        tagUnitId: "tag-a",
        anchor,
      }),
    ).toEqual({
      preview: null,
      selected: ["tag-b"],
    });
  });

  test("selects an explicit chip set", () => {
    const state: TagInteractionState = {
      preview: { tagUnitId: "tag-a", anchor },
      selected: [],
    };

    expect(
      tagInteractionReducer(state, {
        type: "SELECT_CHIPS",
        tagUnitIds: ["tag-a", "tag-b", "tag-a"],
      }),
    ).toEqual({
      preview: null,
      selected: ["tag-a", "tag-b"],
    });
  });

  test("closes preview without clearing selection", () => {
    const state: TagInteractionState = {
      preview: { tagUnitId: "tag-a", anchor },
      selected: ["tag-b"],
    };

    expect(tagInteractionReducer(state, { type: "CLOSE_PREVIEW" })).toEqual({
      preview: null,
      selected: ["tag-b"],
    });
  });
});
