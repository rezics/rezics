import { describe, expect, test } from "bun:test";
import { EmptyState } from "./EmptyState";

function renderProps(props: Parameters<typeof EmptyState>[0]) {
  const element = EmptyState(props);
  return (element as any).props;
}

describe("EmptyState", () => {
  test("renders only the title when no optional slots are provided", () => {
    const props = renderProps({ title: "Nothing here yet" });
    const children = (props.children as Array<any>).filter(Boolean);

    expect(children).toHaveLength(1);
    const title = children[0];
    expect(title.props.variant).toBe("subtitle1");
    expect(title.props.children).toBe("Nothing here yet");
    expect(props.role).toBe("status");
    expect(props["aria-live"]).toBe("polite");
  });

  test("renders icon, description, and action when provided", () => {
    const icon = { type: "svg" } as any;
    const action = { type: "button" } as any;
    const props = renderProps({
      title: "Nothing here yet",
      description: "Try adjusting your filters",
      icon,
      action,
    });
    const children = (props.children as Array<any>).filter(Boolean);

    expect(children).toHaveLength(4);
    const [iconSlot, title, description, actionSlot] = children;
    expect(iconSlot.props.children).toBe(icon);
    expect(title.props.children).toBe("Nothing here yet");
    expect(description.props.variant).toBe("body2");
    expect(description.props.children).toBe("Try adjusting your filters");
    expect(actionSlot.props.children).toBe(action);
  });

  test("omits optional slots individually", () => {
    const props = renderProps({
      title: "Empty",
      description: "Only description",
    });
    const children = (props.children as Array<any>).filter(Boolean);

    expect(children).toHaveLength(2);
    expect(children[0].props.children).toBe("Empty");
    expect(children[1].props.children).toBe("Only description");
  });
});
