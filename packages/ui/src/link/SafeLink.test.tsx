import { describe, expect, test } from "bun:test";
import React from "react";
import { ExternalLink, SafeLink } from "./SafeLink";
import { closeExternal, getExternalLinkSnapshot } from "./store";

function expectElement(node: React.ReactNode): React.ReactElement<any> {
  if (!React.isValidElement(node)) {
    throw new Error("Expected a React element");
  }
  return node;
}

describe("SafeLink", () => {
  test("renders external links with a preserved href and modal click handler", () => {
    closeExternal();
    const node = expectElement(
      SafeLink({ href: "https://example.com", children: "go" }),
    );

    expect(node.type).toBe("a");
    expect(node.props.href).toBe("https://example.com/");
    expect(node.props.target).toBe("_blank");
    expect(node.props.rel).toBe("noopener noreferrer");

    let prevented = false;
    node.props.onClick({
      button: 0,
      preventDefault: () => {
        prevented = true;
      },
    });

    expect(prevented).toBe(true);
    expect(getExternalLinkSnapshot()).toEqual({
      pendingHref: "https://example.com/",
      pendingHost: "example.com",
    });
  });

  test("does not intercept modified external clicks", () => {
    closeExternal();
    const node = expectElement(
      ExternalLink({ href: "https://example.com", children: "go" }),
    );

    let prevented = false;
    node.props.onClick({
      button: 0,
      metaKey: true,
      preventDefault: () => {
        prevented = true;
      },
    });

    expect(prevented).toBe(false);
    expect(getExternalLinkSnapshot()).toEqual({
      pendingHref: null,
      pendingHost: null,
    });
  });

  test("renders rezics links as browser anchors", () => {
    const node = expectElement(
      SafeLink({ href: "https://rezics.com/about", children: "about" }),
    );

    expect(node.type).toBe("a");
    expect(node.props.href).toBe("https://rezics.com/about");
    expect(node.props.target).toBeUndefined();
    expect(node.props.rel).toBe("noopener noreferrer");
  });

  test("renders blocked schemes as text", () => {
    const node = expectElement(
      SafeLink({ href: "javascript:alert(1)", children: "click" }),
    );

    expect(node.type).toBe("span");
    expect(node.props.href).toBeUndefined();
    expect(node.props.onClick).toBeUndefined();
  });

  test("falls back to an anchor for app routes", () => {
    const node = expectElement(
      SafeLink({ href: "/book/123", children: "book" }),
    );

    expect(node.type).toBe("a");
    expect(node.props.href).toBe("/book/123");
  });

  test("uses the injected renderer for app routes", () => {
    const node = expectElement(
      SafeLink({
        href: "/book/123",
        className: "link",
        children: "book",
        linkRenderer: ({ href, children, className }) => (
          <button type="button" data-href={href} className={className}>
            {children}
          </button>
        ),
      }),
    );

    expect(node.type).toBe("button");
    expect(node.props["data-href"]).toBe("/book/123");
    expect(node.props.className).toBe("link");
  });
});
