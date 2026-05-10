import { describe, expect, test } from "bun:test";
import { CursorDecodeError, decodeCursor, encodeCursor } from "./cursor";

describe("reaction cursor", () => {
  test("round-trips a (createdAt, id) pair", () => {
    const original = {
      createdAt: new Date("2026-04-01T12:34:56.789Z"),
      id: "11111111-2222-3333-4444-555555555555",
    };
    const encoded = encodeCursor(original);
    expect(typeof encoded).toBe("string");
    expect(encoded).not.toContain("=");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");

    const decoded = decodeCursor(encoded);
    expect(decoded.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(decoded.id).toBe(original.id);
  });

  test("rejects malformed cursors", () => {
    expect(() => decodeCursor("not-base64-$$$")).toThrow(CursorDecodeError);
    expect(() => decodeCursor(Buffer.from("not json").toString("base64url"))).toThrow(
      CursorDecodeError,
    );
    expect(() =>
      decodeCursor(
        Buffer.from(JSON.stringify({ t: "not-a-date", i: "x" })).toString("base64url"),
      ),
    ).toThrow(CursorDecodeError);
    expect(() =>
      decodeCursor(Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url")),
    ).toThrow(CursorDecodeError);
  });
});
