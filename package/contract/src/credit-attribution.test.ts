import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  creditAttributionBriefSchema,
  creditAttributionDTOSchema,
  creditAttributionRoleKeySchema,
  creditAttributionRoleRegistry,
  createCreditAttributionEvidenceSchema,
  linkCreditAttributionSchema,
} from "./credit-attribution";

describe("credit attribution role registry schemas", () => {
  test("accept registered credit role keys", () => {
    expect(Value.Check(creditAttributionRoleKeySchema, "author")).toBe(true);
    expect(Value.Check(creditAttributionRoleKeySchema, "translator")).toBe(
      true,
    );
  });

  test("reject unregistered credit role keys", () => {
    expect(Value.Check(creditAttributionRoleKeySchema, "color_assistant")).toBe(
      false,
    );
  });

  test("link input validates role keys", () => {
    expect(
      Value.Check(linkCreditAttributionSchema, {
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
      }),
    ).toBe(true);

    expect(
      Value.Check(linkCreditAttributionSchema, {
        unitId: "book-1",
        entityId: "entity-1",
        role: "color_assistant",
      }),
    ).toBe(false);
  });

  test("brief entity exposes avatar", () => {
    expect(
      Value.Check(creditAttributionBriefSchema, {
        entityId: "entity-1",
        name: "Author",
        role: "author",
        entity: {
          unitId: "entity-1",
          kind: "person",
          avatar: "https://cdn.example/entity.png",
        },
      }),
    ).toBe(true);
  });

  test("author registry entry is metadata-prominent for books", () => {
    expect(creditAttributionRoleRegistry.author.appliesToUnitTypes).toContain(
      "BOOK",
    );
    expect(creditAttributionRoleRegistry.author.prominence).toBe("metadata");
    expect(creditAttributionRoleRegistry.author.key).toBe("author");
  });

  test("accepts credit attribution evidence write shape", () => {
    expect(
      Value.Check(createCreditAttributionEvidenceSchema, {
        unitId: "book-1",
        entityId: "publisher-1",
        role: "publisher",
        sourceRefId: "source-ref-1",
        claimPath: "$.bookInfo.publisher",
        observedUrl: "https://book.qidian.com/info/123",
        observedAt: "2026-05-25T00:00:00.000Z",
        confidence: 0.9,
      }),
    ).toBe(true);
  });

  test("keeps evidence optional on credit DTOs", () => {
    expect(
      Value.Check(creditAttributionDTOSchema, {
        unitId: "book-1",
        entityId: "publisher-1",
        role: "publisher",
        sortOrder: 0,
      }),
    ).toBe(true);
  });

  test("accepts credit DTOs with evidence summaries", () => {
    expect(
      Value.Check(creditAttributionDTOSchema, {
        unitId: "book-1",
        entityId: "publisher-1",
        role: "publisher",
        sortOrder: 0,
        evidence: [
          {
            id: "evidence-1",
            unitId: "book-1",
            entityId: "publisher-1",
            role: "publisher",
            sourceRefId: "source-ref-1",
            sourceSiteEntityUnitId: "source-site-1",
            externalKind: "book",
            externalId: "123",
            canonicalUrl: "https://book.qidian.com/info/123",
            claimPath: "$.bookInfo.publisher",
            observedUrl: "https://book.qidian.com/info/123",
            observedAt: "2026-05-25T00:00:00.000Z",
            confidence: 0.9,
          },
        ],
      }),
    ).toBe(true);
  });
});
