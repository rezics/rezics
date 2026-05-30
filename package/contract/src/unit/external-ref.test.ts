import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { externalKindKeySchema } from "../source/external-kind";
import {
  createUnitExternalRefSchema,
  unitExternalRefDTOSchema,
} from "./external-ref";

describe("unit external reference contract schemas", () => {
  test("accepts source identity payloads", () => {
    expect(
      Value.Check(createUnitExternalRefSchema, {
        unitId: "book-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
        originalUrl: "https://book.qidian.com/info/123?from=share",
      }),
    ).toBe(true);
  });

  test("accepts URL-first authoring payloads", () => {
    expect(
      Value.Check(createUnitExternalRefSchema, {
        unitId: "book-1",
        sourceSiteEntityUnitId: "source-site-1",
        observedUrl: "https://book.qidian.com/info/123",
      }),
    ).toBe(true);
  });

  test("rejects unknown external kinds", () => {
    expect(Value.Check(externalKindKeySchema, "isbn")).toBe(false);
    expect(
      Value.Check(createUnitExternalRefSchema, {
        unitId: "book-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "isbn",
        externalId: "9780000000000",
      }),
    ).toBe(false);
  });

  test("validates read DTO shape", () => {
    expect(
      Value.Check(unitExternalRefDTOSchema, {
        id: "ref-1",
        unitId: "book-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
        canonicalUrl: "https://book.qidian.com/info/123",
        originalUrl: null,
        firstSeenAt: "2026-05-25T00:00:00.000Z",
        lastSeenAt: "2026-05-25T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
