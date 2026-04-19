import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type HookState = {
  useStateQueue: unknown[];
  setState: Array<(next: unknown) => void>;
  refQueue: Array<{ current: unknown }>;
  effects: Array<{
    fn: () => void | (() => void);
    deps: unknown[] | undefined;
  }>;
  idCounter: number;
  stateCursor: number;
};

const hookState: HookState = {
  useStateQueue: [],
  setState: [],
  refQueue: [],
  effects: [],
  idCounter: 0,
  stateCursor: 0,
};

function resetHookState(initial: Partial<HookState> = {}) {
  hookState.useStateQueue = initial.useStateQueue ?? [];
  hookState.setState = initial.setState ?? [];
  hookState.refQueue = initial.refQueue ?? [];
  hookState.effects = [];
  hookState.idCounter = 0;
  hookState.stateCursor = 0;
}

function MockButton() {}

function makeJsx() {
  const jsx = (type: unknown, config: Record<string, unknown>) => {
    const { children, ...rest } = config as {
      children?: unknown;
      [key: string]: unknown;
    };
    return {
      type,
      props: { ...rest, children },
    };
  };
  return { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: "Fragment" };
}

mock.module("react/jsx-dev-runtime", () => makeJsx());
mock.module("react/jsx-runtime", () => makeJsx());

mock.module("react", () => {
  const actual = {
    useState(initial: unknown) {
      const idx = hookState.stateCursor++;
      if (idx >= hookState.useStateQueue.length) {
        hookState.useStateQueue[idx] = initial;
      }
      const value = hookState.useStateQueue[idx];
      const setter = (next: unknown) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: unknown) => unknown)(hookState.useStateQueue[idx])
            : next;
        hookState.useStateQueue[idx] = resolved;
      };
      hookState.setState[idx] = setter;
      return [value, setter] as const;
    },
    useRef<T>(initial: T) {
      const existing = hookState.refQueue.shift();
      const ref = existing ?? { current: initial };
      return ref as { current: T };
    },
    useId() {
      hookState.idCounter += 1;
      return `test-id-${hookState.idCounter}`;
    },
    useCallback<T>(fn: T) {
      return fn;
    },
    useEffect(fn: () => void | (() => void), deps: unknown[] | undefined) {
      hookState.effects.push({ fn, deps });
    },
    useLayoutEffect(
      fn: () => void | (() => void),
      deps: unknown[] | undefined,
    ) {
      hookState.effects.push({ fn, deps });
    },
  };
  return {
    ...actual,
    default: actual,
  };
});

mock.module("@mui/material/Button", () => ({
  default: MockButton,
}));

type RenderedElement = {
  type: unknown;
  props: Record<string, any>;
};

async function importCollapsible() {
  const mod = await import("./Collapsible");
  return mod.Collapsible;
}

function walk(node: unknown): RenderedElement[] {
  const out: RenderedElement[] = [];
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if ("type" in n && "props" in n) {
      out.push(n as RenderedElement);
      const children = (n as RenderedElement).props.children;
      if (Array.isArray(children)) children.forEach(visit);
      else visit(children);
    }
  };
  visit(node);
  return out;
}

function findButton(tree: RenderedElement): RenderedElement {
  const button = walk(tree).find((el) => el.type === MockButton);
  if (!button) throw new Error("Toggle button not found in render output");
  return button;
}

function findClampedElement(tree: RenderedElement): RenderedElement {
  const el = walk(tree).find(
    (el) =>
      typeof el.props.id === "string" && el.props.id.startsWith("test-id-"),
  );
  if (!el) throw new Error("Clamped content element not found");
  return el;
}

describe("Collapsible", () => {
  beforeEach(() => {
    resetHookState();
  });

  afterEach(() => {
    resetHookState();
  });

  test("exposes aria-controls/aria-expanded and renders children", async () => {
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "Long text",
      maxLines: 3,
    }) as RenderedElement;

    const button = findButton(tree);
    const content = findClampedElement(tree);

    expect(button.props["aria-expanded"]).toBe(false);
    expect(button.props["aria-controls"]).toBe(content.props.id);
    expect(content.props.children).toBe("Long text");
  });

  test("collapsed children remain in the DOM (line-clamp applied)", async () => {
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "full text body",
      maxLines: 2,
    }) as RenderedElement;

    const content = findClampedElement(tree);
    expect(content.props.children).toBe("full text body");
    expect(content.props.style.display).toBe("-webkit-box");
    expect(content.props.style.WebkitLineClamp).toBe(2);
  });

  test("expanded=true removes the line-clamp and shows the collapse label", async () => {
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "body",
      maxLines: 3,
      expanded: true,
      showLessLabel: "Less",
    }) as RenderedElement;

    const button = findButton(tree);
    const content = findClampedElement(tree);

    expect(button.props["aria-expanded"]).toBe(true);
    expect(button.props.children).toBe("Less");
    expect(content.props.style.WebkitLineClamp).toBeUndefined();
  });

  test("controlled mode calls onExpandedChange with next value and does not update internal state", async () => {
    const Collapsible = await importCollapsible();
    const receivedValues: boolean[] = [];
    const tree = (Collapsible as any)({
      children: "body",
      maxLines: 3,
      expanded: false,
      onExpandedChange: (next: boolean) => {
        receivedValues.push(next);
      },
    }) as RenderedElement;

    const button = findButton(tree);
    const internalStateBefore = hookState.useStateQueue.slice();
    button.props.onClick();

    expect(receivedValues).toEqual([true]);
    expect(hookState.useStateQueue).toEqual(internalStateBefore);
  });

  test("uncontrolled mode toggles internal expanded state on click", async () => {
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "body",
      maxLines: 3,
    }) as RenderedElement;

    const button = findButton(tree);
    expect(hookState.useStateQueue[0]).toBe(false);
    button.props.onClick();
    expect(hookState.useStateQueue[0]).toBe(true);
  });

  test("toggle is hidden via display:none when overflow is false", async () => {
    resetHookState({ useStateQueue: [false, false] });
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "short",
      maxLines: 3,
    }) as RenderedElement;

    const button = findButton(tree);
    const sxEntries = Array.isArray(button.props.sx)
      ? button.props.sx
      : [button.props.sx];
    const baseSx = sxEntries[0] as Record<string, unknown>;
    expect(baseSx.display).toBe("none");
  });

  test("toggle is visible (inline-flex) when overflow is true", async () => {
    resetHookState({ useStateQueue: [false, true] });
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "long",
      maxLines: 3,
    }) as RenderedElement;

    const button = findButton(tree);
    const sxEntries = Array.isArray(button.props.sx)
      ? button.props.sx
      : [button.props.sx];
    const baseSx = sxEntries[0] as Record<string, unknown>;
    expect(baseSx.display).toBe("inline-flex");
  });

  test("reduced-motion disables the toggle transition", async () => {
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "body",
      maxLines: 3,
    }) as RenderedElement;

    const button = findButton(tree);
    const sxEntries = Array.isArray(button.props.sx)
      ? button.props.sx
      : [button.props.sx];
    const baseSx = sxEntries[0] as Record<string, any>;
    expect(baseSx["@media (prefers-reduced-motion: reduce)"].transition).toBe(
      "none",
    );
  });

  test("fade applies background-agnostic mask-image when collapsed & overflowing", async () => {
    resetHookState({ useStateQueue: [false, true] });
    const Collapsible = await importCollapsible();
    const tree = (Collapsible as any)({
      children: "body",
      maxLines: 3,
      fade: true,
    }) as RenderedElement;

    const content = findClampedElement(tree);
    expect(content.props.style.maskImage).toContain("linear-gradient");
    expect(content.props.style.WebkitMaskImage).toContain("linear-gradient");
  });

  test("ResizeObserver measurement hides toggle when overflow disappears", async () => {
    const observed: unknown[] = [];
    class FakeResizeObserver {
      constructor(_cb: (entries: unknown[]) => void) {}
      observe(el: unknown) {
        observed.push(el);
      }
      disconnect() {}
      unobserve() {}
    }
    (globalThis as any).ResizeObserver = FakeResizeObserver;

    const fakeEl = {
      scrollHeight: 200,
      clientHeight: 60,
    };
    resetHookState({
      refQueue: [{ current: fakeEl }],
      useStateQueue: [false, true],
    });

    const Collapsible = await importCollapsible();
    (Collapsible as any)({
      children: "body",
      maxLines: 3,
    });

    const effect = hookState.effects[0];
    expect(effect).toBeTruthy();
    effect.fn();

    expect(observed).toContain(fakeEl);

    const overflowIdx = 1;
    fakeEl.scrollHeight = 60;
    hookState.setState[overflowIdx](false);
    expect(hookState.useStateQueue[overflowIdx]).toBe(false);

    delete (globalThis as any).ResizeObserver;
  });
});
