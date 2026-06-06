import { describe, expect, test } from "bun:test";
import { isContractScope, resolveScope } from "./scope";

describe("resolveScope", () => {
  test("resolves /realm/:id to realm scope", () => {
    expect(resolveScope("/realm/abc123")).toEqual({
      kind: "realm",
      realmId: "abc123",
    });
  });

  test("resolves /realm/:id/sub to realm scope", () => {
    expect(resolveScope("/realm/abc123/posts")).toEqual({
      kind: "realm",
      realmId: "abc123",
    });
  });

  test("/realm/search directory falls back to global", () => {
    expect(resolveScope("/realm/search")).toEqual({ kind: "global" });
  });

  test("/realm/new directory falls back to global", () => {
    expect(resolveScope("/realm/new")).toEqual({ kind: "global" });
  });

  test("resolves /user/:id to user scope", () => {
    expect(resolveScope("/user/u_42")).toEqual({
      kind: "user",
      userId: "u_42",
    });
  });

  test("resolves /user/me to user scope with userId 'me'", () => {
    expect(resolveScope("/user/me")).toEqual({
      kind: "user",
      userId: "me",
    });
  });

  test("resolves /u/:slug to userSlug intermediate", () => {
    expect(resolveScope("/u/alice")).toEqual({
      kind: "userSlug",
      userSlug: "alice",
    });
  });

  test("resolves /u/:slug/sub to userSlug intermediate", () => {
    expect(resolveScope("/u/alice/library")).toEqual({
      kind: "userSlug",
      userSlug: "alice",
    });
  });

  test("resolves /book/:id to book scope", () => {
    expect(resolveScope("/book/b_99")).toEqual({
      kind: "book",
      unitId: "b_99",
    });
  });

  test("/book/search directory falls back to global", () => {
    expect(resolveScope("/book/search")).toEqual({ kind: "global" });
  });

  test("/book/new directory falls back to global", () => {
    expect(resolveScope("/book/new")).toEqual({ kind: "global" });
  });

  test("unknown path falls back to global", () => {
    expect(resolveScope("/feedback/admin")).toEqual({ kind: "global" });
  });

  test("root path falls back to global", () => {
    expect(resolveScope("/")).toEqual({ kind: "global" });
  });

  test("empty path falls back to global", () => {
    expect(resolveScope("")).toEqual({ kind: "global" });
  });
});

describe("isContractScope", () => {
  test("narrows out userSlug", () => {
    expect(isContractScope({ kind: "userSlug", userSlug: "alice" })).toBe(
      false,
    );
  });

  test("accepts global", () => {
    expect(isContractScope({ kind: "global" })).toBe(true);
  });

  test("accepts realm", () => {
    expect(isContractScope({ kind: "realm", realmId: "r1" })).toBe(true);
  });

  test("accepts user", () => {
    expect(isContractScope({ kind: "user", userId: "u1" })).toBe(true);
  });

  test("accepts book", () => {
    expect(isContractScope({ kind: "book", unitId: "b1" })).toBe(true);
  });
});
