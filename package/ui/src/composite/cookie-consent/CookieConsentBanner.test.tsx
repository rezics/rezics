import { describe, expect, mock, test } from "bun:test";

mock.module("@mui/material/Button", () => ({
  default: (props: Record<string, unknown>) => ({
    type: "Button",
    props,
  }),
}));

mock.module("@mui/material/Stack", () => ({
  default: (props: Record<string, unknown>) => ({
    type: "Stack",
    props,
  }),
}));

mock.module("@mui/material/Typography", () => ({
  default: (props: Record<string, unknown>) => ({
    type: "Typography",
    props,
  }),
}));

describe("CookieConsentBanner", () => {
  test("renders configurable labels and keeps policy access visible", async () => {
    const { CookieConsentBanner } = await import("./CookieConsentBanner");

    const element = CookieConsentBanner({
      title: "Cookies on Rezics",
      body: "We use cookies to keep you signed in.",
      policyLabel: "Review policy",
      acceptLabel: "Allow cookies",
      onAccept: () => undefined,
      onPolicyClick: () => undefined,
      secondaryAction: {
        label: "Not now",
        onClick: () => undefined,
      },
    }) as any;

    const stack = element.props.children;
    const actions = stack.props.children[1];
    const buttons = actions.props.children;

    expect(element.props["aria-label"]).toBe("Cookies on Rezics");
    expect(buttons[0].props.children).toBe("Review policy");
    expect(buttons[1].props.children).toBe("Not now");
    expect(buttons[2].props.children).toBe("Allow cookies");
  });

  test("supports host-provided policy actions without internal navigation logic", async () => {
    const { CookieConsentBanner } = await import("./CookieConsentBanner");

    const policyAction = {
      type: "a",
      props: {
        href: "/cookies",
        children: "Cookie policy",
      },
    } as any;

    const element = CookieConsentBanner({
      title: "Cookies on Rezics",
      body: "We use cookies to keep you signed in.",
      policyLabel: "Ignored",
      onAccept: () => undefined,
      onPolicyClick: () => undefined,
      policyAction,
    }) as any;

    const actions = element.props.children.props.children[1];
    expect(actions.props.children[0]).toBe(policyAction);
  });
});
