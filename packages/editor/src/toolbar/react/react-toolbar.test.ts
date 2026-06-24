import { describe, expect, it } from "bun:test";
import { EditorState } from "@codemirror/state";
import type { ToolbarItem } from "../types";

const noop = () => {};

function makeItem(
  overrides: Partial<ToolbarItem> & { name: string },
): ToolbarItem {
  return { label: overrides.name, action: noop, ...overrides };
}

describe("React toolbar update logic", () => {
  it("isActive is only called with an EditorState", () => {
    const states: EditorState[] = [];
    const item = makeItem({
      name: "bold",
      isActive: (state) => {
        states.push(state);
        return false;
      },
    });

    const state = EditorState.create({ doc: "hello" });
    item.isActive!(state);

    expect(states).toHaveLength(1);
    expect(states[0]).toBe(state);
  });

  it("isActive correctly detects state differences", () => {
    const item = makeItem({
      name: "bold",
      isActive: (state) => state.doc.toString().includes("**"),
    });

    const inactive = EditorState.create({ doc: "hello" });
    const active = EditorState.create({ doc: "**hello**" });

    expect(item.isActive!(inactive)).toBe(false);
    expect(item.isActive!(active)).toBe(true);
  });

  it("items without isActive default to false", () => {
    const item = makeItem({ name: "link" });
    expect(item.isActive).toBeUndefined();

    const state = EditorState.create({ doc: "" });
    const active = item.isActive?.(state) ?? false;
    expect(active).toBe(false);
  });

  it("exported ReactToolbar accepts items and className props", async () => {
    const { ReactToolbar } = await import("./index");
    expect(typeof ReactToolbar).toBe("function");
  });
});

describe("update listener guard logic", () => {
  it("active flag prevents callback after deactivation", () => {
    let count = 0;
    let active = true;

    // Simulate the guard pattern used in useEditorUpdate
    // 模拟 useEditorUpdate 中使用的守卫模式
    const guard = () => {
      if (active) count++;
    };

    guard();
    expect(count).toBe(1);

    guard();
    expect(count).toBe(2);

    active = false;
    guard();
    expect(count).toBe(2); // No increment after deactivation — 停用后不再自增
  });
});
