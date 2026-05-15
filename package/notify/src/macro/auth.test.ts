import { describe, expect, test } from "bun:test";
import { readCookie, resolveSessionToken } from "./auth";

describe("readCookie", () => {
  test("extracts cookie value by name", () => {
    expect(
      readCookie("foo=bar; rezics-session-token=abc.def.ghi", "rezics-session-token"),
    ).toBe("abc.def.ghi");
  });

  test("returns null when cookie header is empty", () => {
    expect(readCookie(undefined, "rezics-session-token")).toBe(null);
    expect(readCookie("", "rezics-session-token")).toBe(null);
  });

  test("returns null when name does not match", () => {
    expect(readCookie("other=1", "rezics-session-token")).toBe(null);
  });

  test("URL-decodes value", () => {
    expect(readCookie("x=hello%20world", "x")).toBe("hello world");
  });
});

describe("resolveSessionToken", () => {
  test("returns Authorization value with Bearer prefix stripped", () => {
    expect(resolveSessionToken("Bearer my.jwt.token", undefined)).toBe(
      "my.jwt.token",
    );
  });

  test("returns Authorization value with case-insensitive Bearer prefix", () => {
    expect(resolveSessionToken("bearer my.jwt.token", undefined)).toBe(
      "my.jwt.token",
    );
  });

  test("returns cookie value when Authorization absent", () => {
    expect(
      resolveSessionToken(undefined, "rezics-session-token=cookie.jwt.token"),
    ).toBe("cookie.jwt.token");
  });

  test("Authorization takes precedence when both present", () => {
    expect(
      resolveSessionToken(
        "Bearer header.jwt",
        "rezics-session-token=cookie.jwt",
      ),
    ).toBe("header.jwt");
  });

  test("returns null when neither Authorization nor cookie has a token", () => {
    expect(resolveSessionToken(undefined, undefined)).toBe(null);
    expect(resolveSessionToken(undefined, "other=1")).toBe(null);
  });

  test("returns Authorization raw value when no Bearer prefix", () => {
    expect(resolveSessionToken("raw.jwt.token", undefined)).toBe("raw.jwt.token");
  });
});
