import { describe, expect, test } from "bun:test";
import type { TagSearchDocument } from "@rezics/contract";
import {
  tagOptionLabel,
  tagSearchOptionFromDoc,
} from "./tagSearchOption";

describe("tagSearchOptionFromDoc", () => {
  test("maps title and slug from document", () => {
    const doc = {
      unitId: "u1",
      title: "React",
      titles: ["React", "リアクト"],
      slug: "react",
    } as TagSearchDocument;
    expect(tagSearchOptionFromDoc(doc)).toEqual({
      unitId: "u1",
      label: "React",
      slug: "react",
    });
  });

  test("falls back to first titles entry when title is null", () => {
    const doc = {
      unitId: "u2",
      title: null,
      titles: ["Fallback"],
      slug: null,
    } as TagSearchDocument;
    expect(tagSearchOptionFromDoc(doc)).toEqual({
      unitId: "u2",
      label: "Fallback",
      slug: null,
    });
  });

  test("returns null label when no title available", () => {
    const doc = {
      unitId: "u3",
      title: null,
      titles: [],
      slug: null,
    } as TagSearchDocument;
    expect(tagSearchOptionFromDoc(doc)).toEqual({
      unitId: "u3",
      label: null,
      slug: null,
    });
  });
});

describe("tagOptionLabel", () => {
  test("prefers label", () => {
    expect(tagOptionLabel({ unitId: "u1", label: "React", slug: "react" }))
      .toBe("React");
  });

  test("falls back to slug", () => {
    expect(tagOptionLabel({ unitId: "u1", label: null, slug: "react" }))
      .toBe("react");
  });

  test("falls back to unitId", () => {
    expect(tagOptionLabel({ unitId: "u1", label: null, slug: null }))
      .toBe("u1");
  });
});
