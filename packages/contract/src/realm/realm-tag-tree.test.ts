import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "bun:test";
import {
  emptyRealmTagTree,
  parseRealmTagTree,
  realmTagTreeEnvelopeSchema,
  realmTagTreeNodeSchema,
  realmTagTreeV1Schema,
} from "./realm-tag-tree";

describe("realm tag tree contract", () => {
  test("accepts tag and label nodes without durable node ids", () => {
    const tree = {
      schema: "rezics/realm-tag-tree",
      version: 1,
      view: { defaultMode: "tree", allowViewerSwitch: true },
      nodes: [
        {
          kind: "label",
          labelUnitId: "label-1",
          children: [
            {
              kind: "tag",
              tagUnitId: "tag-1",
              labelUnitId: "label-2",
              querySource: "policy",
            },
          ],
        },
      ],
    };

    expect(Value.Check(realmTagTreeEnvelopeSchema, tree)).toBe(true);
    expect(parseRealmTagTree(tree)).toEqual(tree);
  });

  test("rejects old inline label payloads and node ids", () => {
    expect(
      Value.Check(realmTagTreeNodeSchema, {
        id: "node-1",
        kind: "tag",
        tagUnitId: "tag-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmTagTreeNodeSchema, {
        kind: "label",
        label: "Genre",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmTagTreeNodeSchema, {
        kind: "label",
        labelUnitId: "label-1",
        labelTranslations: { translations: { en: "Genre" } },
      }),
    ).toBe(false);
  });

  test("keeps policy query source only on tag nodes", () => {
    expect(
      Value.Check(realmTagTreeNodeSchema, {
        kind: "label",
        labelUnitId: "label-1",
        querySource: "policy",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmTagTreeNodeSchema, {
        kind: "tag",
        tagUnitId: "tag-1",
        querySource: "policy",
      }),
    ).toBe(true);
  });

  test("default tree is a valid empty envelope", () => {
    expect(Value.Check(realmTagTreeV1Schema, emptyRealmTagTree())).toBe(true);
  });
});
