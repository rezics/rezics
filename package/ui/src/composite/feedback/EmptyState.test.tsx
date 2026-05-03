import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";

import { EmptyState, type EmptyStateProps } from "./EmptyState";

type AnyNode =
  | ReactElement<{ children?: unknown; className?: string }>
  | null
  | undefined
  | false;

function renderProps(props: EmptyStateProps) {
  const element = EmptyState(props) as ReactElement<{
    children: AnyNode | AnyNode[];
    role?: string;
    "aria-live"?: string;
  }>;
  return element.props;
}

function nonNullChildren(children: AnyNode | AnyNode[]): ReactElement[] {
  const list = Array.isArray(children) ? children : [children];
  return list.filter(
    (child) => Boolean(child) && typeof child === "object",
  ) as ReactElement[];
}

describe("EmptyState", () => {
  test("renders title only when no optional slots are provided", () => {
    const props = renderProps({ title: "Nothing here yet" });
    const slots = nonNullChildren(props.children);

    expect(slots).toHaveLength(1);
    expect((slots[0]?.props as { children?: unknown }).children).toBe(
      "Nothing here yet",
    );
    expect(props.role).toBe("status");
    expect(props["aria-live"]).toBe("polite");
  });

  test("renders icon, description, and action when provided", () => {
    const icon = { type: "svg" } as unknown as ReactElement;
    const action = { type: "button" } as unknown as ReactElement;

    const props = renderProps({
      title: "Nothing here yet",
      description: "Try adjusting your filters",
      icon,
      action,
    });
    const slots = nonNullChildren(props.children);

    expect(slots).toHaveLength(4);
    const [iconSlot, title, description, actionSlot] = slots as Array<
      ReactElement<{ children: unknown }>
    >;
    expect(iconSlot.props.children).toBe(icon);
    expect(title.props.children).toBe("Nothing here yet");
    expect(description.props.children).toBe("Try adjusting your filters");
    expect(actionSlot.props.children).toBe(action);
  });

  test("omits optional slots individually", () => {
    const props = renderProps({
      title: "Empty",
      description: "Only description",
    });
    const slots = nonNullChildren(props.children);

    expect(slots).toHaveLength(2);
    expect((slots[0]?.props as { children?: unknown }).children).toBe("Empty");
    expect((slots[1]?.props as { children?: unknown }).children).toBe(
      "Only description",
    );
  });

  test("does not import @mui/material (smoke check)", async () => {
    const source = await Bun.file(
      new URL("./EmptyState.tsx", import.meta.url),
    ).text();
    expect(source.includes("@mui/")).toBe(false);
  });
});
