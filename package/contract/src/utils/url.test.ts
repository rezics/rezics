import { describe, expect, test } from "bun:test";
import { classifyUrl } from "./url";

describe("classifyUrl", () => {
  test("app routes", () => {
    expect(classifyUrl("/profile/me")).toEqual({
      kind: "app-route",
      href: "/profile/me",
    });
    expect(classifyUrl("/book/123")).toEqual({
      kind: "app-route",
      href: "/book/123",
    });
    expect(classifyUrl("/")).toEqual({ kind: "external", href: "/" });
  });

  test("rezics root domain", () => {
    const result = classifyUrl("https://rezics.com/about");
    expect(result.kind).toBe("rezics");
  });

  test("rezics subdomain", () => {
    const result = classifyUrl("book.rezics.com/shelf/abc");
    expect(result.kind).toBe("rezics");
    expect(result.href).toStartWith("https://");
  });

  test("look-alike host rejected", () => {
    expect(classifyUrl("https://rezics.com.attacker.com/path").kind).toBe(
      "external",
    );
    expect(classifyUrl("https://notrezics.com").kind).toBe("external");
    expect(classifyUrl("https://fakerezics.com").kind).toBe("external");
  });

  test("external URL", () => {
    const result = classifyUrl("https://example.com/article");
    expect(result).toEqual({
      kind: "external",
      href: "https://example.com/article",
    });
  });

  test("malformed URL treated as external", () => {
    expect(classifyUrl("not a url").kind).toBe("external");
  });

  test("blocked schemes", () => {
    expect(classifyUrl("javascript:alert(1)")).toEqual({
      kind: "blocked",
      href: "",
    });
    expect(classifyUrl("data:text/html,<h1>hi</h1>")).toEqual({
      kind: "blocked",
      href: "",
    });
    expect(classifyUrl('vbscript:MsgBox("hi")')).toEqual({
      kind: "blocked",
      href: "",
    });
  });

  test("blocked schemes case-insensitive", () => {
    expect(classifyUrl("JavaScript:alert(1)").kind).toBe("blocked");
    expect(classifyUrl("JAVASCRIPT:alert(1)").kind).toBe("blocked");
    expect(classifyUrl("DATA:text/html,x").kind).toBe("blocked");
  });

  test("defaults missing scheme to https", () => {
    const result = classifyUrl("example.com/page");
    expect(result.kind).toBe("external");
    expect(result.href).toBe("https://example.com/page");
  });

  test("rezics with missing scheme", () => {
    const result = classifyUrl("rezics.com/about");
    expect(result.kind).toBe("rezics");
    expect(result.href).toBe("https://rezics.com/about");
  });
});
