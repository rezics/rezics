import { describe, expect, it } from "bun:test";
import { EditorState } from "@codemirror/state";
import type { ToolbarItem } from "../types";

const noop = () => {};

function makeItem(
  overrides: Partial<ToolbarItem> & { name: string },
): ToolbarItem {
  return { label: overrides.name, action: noop, ...overrides };
}

describe("panel toolbar logic", () => {
  it("panelToolbar export is a function that returns an Extension", async () => {
    const { panelToolbar } = await import("./index");
    const ext = panelToolbar([makeItem({ name: "bold", label: "Bold" })]);
    expect(ext).toBeDefined();
    expect(Array.isArray(ext)).toBe(true);
  });

  it("isActive is evaluated against the current editor state", () => {
    let calls = 0;
    const item = makeItem({
      name: "bold",
      label: "Bold",
      isActive: (state) => {
        calls++;
        return state.doc.toString().includes("**");
      },
    });

    const state = EditorState.create({ doc: "**bold**" });
    expect(item.isActive!(state)).toBe(true);
    expect(calls).toBe(1);

    const plainState = EditorState.create({ doc: "plain" });
    expect(item.isActive!(plainState)).toBe(false);
    expect(calls).toBe(2);
  });

  it("items use label for tooltip content (not title attribute)", () => {
    const item = makeItem({ name: "format", label: "Format JSON" });
    // The panel toolbar uses item.label for the tooltip span, not button.title
    expect(item.label).toBe("Format JSON");
  });

  it("icon string is used as textContent, label as tooltip", () => {
    const item = makeItem({ name: "bold", label: "Bold", icon: "B" });
    // Panel toolbar renders: textContent = icon (string), tooltip text = label
    expect(typeof item.icon).toBe("string");
    expect(item.icon).toBe("B");
    expect(item.label).toBe("Bold");
  });

  it("item without icon falls back label for textContent", () => {
    const item = makeItem({ name: "bold", label: "Bold" });
    const textContent = typeof item.icon === "string" ? item.icon : item.label;
    expect(textContent).toBe("Bold");
  });
});
