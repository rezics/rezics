import type { Static } from "elysia";
import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { tagQuerySourceSchema } from "../tag/tag";

export const REALM_TAG_TREE_SCHEMA = "rezics/realm-tag-tree" as const;
export const REALM_TAG_TREE_V1_VERSION = 1 as const;

export const realmTagViewModeValues = ["flat", "grouped", "tree"] as const;

export const realmTagViewModeSchema = t.Union([
  t.Literal("flat"),
  t.Literal("grouped"),
  t.Literal("tree"),
]);

export type RealmTagViewMode = Static<typeof realmTagViewModeSchema>;

export const realmTagTreeViewSchema = t.Object(
  {
    defaultMode: realmTagViewModeSchema,
    allowViewerSwitch: t.Boolean(),
  },
  { additionalProperties: false },
);

export type RealmTagTreeView = Static<typeof realmTagTreeViewSchema>;

export type RealmTagTreeNode =
  | {
      kind: "tag";
      tagUnitId: string;
      labelUnitId?: string;
      querySource?: "normal" | "policy";
      children?: RealmTagTreeNode[];
    }
  | {
      kind: "label";
      labelUnitId: string;
      children?: RealmTagTreeNode[];
    };

export const realmTagTreeNodeSchema: ReturnType<typeof t.Recursive> =
  t.Recursive((self) =>
    t.Union([
      t.Object(
        {
          kind: t.Literal("tag"),
          tagUnitId: t.String({ minLength: 1 }),
          labelUnitId: t.Optional(t.String({ minLength: 1 })),
          querySource: t.Optional(tagQuerySourceSchema),
          children: t.Optional(t.Array(self)),
        },
        { additionalProperties: false },
      ),
      t.Object(
        {
          kind: t.Literal("label"),
          labelUnitId: t.String({ minLength: 1 }),
          children: t.Optional(t.Array(self)),
        },
        { additionalProperties: false },
      ),
    ]),
  );

export const realmTagTreeV1Schema = t.Object(
  {
    schema: t.Literal(REALM_TAG_TREE_SCHEMA),
    version: t.Literal(REALM_TAG_TREE_V1_VERSION),
    view: realmTagTreeViewSchema,
    nodes: t.Array(realmTagTreeNodeSchema),
  },
  { additionalProperties: false },
);

export type RealmTagTreeV1 = Omit<
  Static<typeof realmTagTreeV1Schema>,
  "nodes"
> & {
  nodes: RealmTagTreeNode[];
};

export type RealmTagTree = RealmTagTreeV1;

export const realmTagTreeEnvelopeSchema = t.Union([realmTagTreeV1Schema]);

const realmTagTreeParser = createVersionedEnvelopeParser<RealmTagTree>({
  schemaName: REALM_TAG_TREE_SCHEMA,
  latestVersion: REALM_TAG_TREE_V1_VERSION,
  latestSchema: realmTagTreeV1Schema,
  versions: [
    {
      version: 1,
      schema: realmTagTreeV1Schema,
      upgrade: (tree) => tree as RealmTagTree,
    },
  ],
});

export function emptyRealmTagTree(): RealmTagTree {
  return {
    schema: REALM_TAG_TREE_SCHEMA,
    version: REALM_TAG_TREE_V1_VERSION,
    view: {
      defaultMode: "flat",
      allowViewerSwitch: true,
    },
    nodes: [],
  };
}

export function parseRealmTagTree(value: unknown): RealmTagTree | null {
  const tree = realmTagTreeParser.parse(value);
  if (!tree || !Value.Check(realmTagTreeV1Schema, tree)) return null;
  return tree;
}

export const realmTagTreeReadResponseSchema = t.Object(
  {
    realmUnitId: t.String(),
    tree: realmTagTreeEnvelopeSchema,
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type RealmTagTreeReadResponse = Static<
  typeof realmTagTreeReadResponseSchema
>;

export const updateRealmTagTreeSchema = t.Object(
  {
    tree: realmTagTreeEnvelopeSchema,
  },
  { additionalProperties: false },
);

export type UpdateRealmTagTreeInput = Static<typeof updateRealmTagTreeSchema>;
