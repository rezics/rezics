import { describe, expect, test } from "bun:test";
import React from "react";
import { DialogContent } from "./dialog";

// Walk a React element tree (without rendering) to find the node carrying a
// given `data-slot`. Rendering needs Base UI dialog context + a DOM, so we
// inspect the element tree directly instead — same approach as SafeLink.test.
// 在不渲染的情况下遍历 React 元素树，找到带指定 `data-slot` 的节点。渲染需要
// Base UI 对话框上下文与 DOM，故直接检查元素树——与 SafeLink.test 同法。
function findBySlot(
  node: React.ReactNode,
  slot: string,
): React.ReactElement<{ className?: string }> | null {
  if (!React.isValidElement(node)) return null;
  const props = node.props as {
    "data-slot"?: string;
    children?: React.ReactNode;
  };
  if (props["data-slot"] === slot) {
    return node as React.ReactElement<{ className?: string }>;
  }
  for (const child of React.Children.toArray(props.children)) {
    const found = findBySlot(child, slot);
    if (found) return found;
  }
  return null;
}

describe("DialogContent is scroll-safe on short viewports by default", () => {
  const popup = findBySlot(DialogContent({ children: null }), "dialog-content");
  const className = String(popup?.props.className ?? "");

  test("renders the dialog-content popup", () => {
    expect(popup).not.toBeNull();
  });

  test("caps height to the viewport so tall content cannot push the footer off-screen", () => {
    // The whole point of the fix: without a height cap, a long form on a short
    // viewport pushes its submit/close controls below the fold, unreachable.
    // 修复的核心：没有高度上限时，矮视口下的长表单会把提交/关闭控件顶到屏外、够不到。
    expect(className).toContain("max-h-[calc(100dvh-2rem)]");
  });

  test("scrolls internally instead of overflowing the viewport", () => {
    expect(className).toContain("overflow-y-auto");
  });
});
