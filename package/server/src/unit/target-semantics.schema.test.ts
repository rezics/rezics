import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Comment,
  CommentPromotion,
  ContentStructure,
  ContentStructureAnchor,
  ContentStructureNode,
  ModerationAction,
  ModerationCase,
  Post,
  Subscription,
  Unit,
  UnitRealm,
} from "../db/schema";

const schemaSource = [
  "catalog",
  "content-structure",
  "discussion",
  "engagement",
  "governance",
  "realm",
]
  .map((name) =>
    readFileSync(new URL(`../db/schema/${name}.ts`, import.meta.url), "utf8"),
  )
  .join("\n");

function expectColumn(table: object, fieldName: string) {
  expect(fieldName in table).toBe(true);
}

function expectNoColumn(table: object, fieldName: string) {
  expect(fieldName in table).toBe(false);
}

function expectSource(fragment: string) {
  expect(schemaSource).toContain(fragment);
}

function expectNoSource(fragment: string) {
  expect(schemaSource).not.toContain(fragment);
}

describe("Unit target semantics in Drizzle schema", () => {
  test("keeps targetUnitId as the only generic persisted Unit target column", () => {
    expectColumn(Unit, "targetUnitId");

    for (const table of [
      Post,
      Subscription,
      ModerationCase,
      ModerationAction,
      UnitRealm,
      CommentPromotion,
    ]) {
      expectNoColumn(table, "targetUnitId");
    }
  });

  test("names non-canonical operation endpoints by their owning domain", () => {
    expectColumn(Subscription, "subscribedUnitId");
    expectSource("Subscription_subscriberUnitId_subscribedUnitId_key");
    expectSource("Subscription_subscribedUnitId_idx");

    expectColumn(ModerationCase, "targetKind");
    expectColumn(ModerationCase, "targetId");
    expectColumn(ModerationCase, "addressedUnitId");
    expectSource("ModerationCase_targetKind_targetId_idx");
    expectSource("ModerationCase_addressedUnitId_state_idx");

    expectColumn(ModerationAction, "targetKind");
    expectColumn(ModerationAction, "targetId");
    expectColumn(ModerationAction, "resultingStatus");
    expectColumn(ModerationAction, "resultingLocked");
    expectColumn(ModerationAction, "idempotencyKey");
    expectNoSource("before");
    expectNoSource("after");
    expectSource("ModerationAction_targetKind_targetId_createdAt_id_idx");
    expectSource(
      "ModerationAction_targetKind_targetId_actionKind_createdAt_i_idx",
    );

    expectColumn(UnitRealm, "moderationStatus");
    expectColumn(UnitRealm, "isLocked");
    expectSource("UnitRealm_pkey");
    expectSource("UnitRealm_realmUnitId_moderationStatus_createdAt_idx");

    expectColumn(CommentPromotion, "commentId");
    expectSource("CommentPromotion_pkey");
  });

  test("keeps topology and structure fields out of canonical Unit targeting", () => {
    expectColumn(Comment, "rootUnitId");
    expectColumn(Comment, "realmUnitId");
    expectColumn(Comment, "parentCommentId");
    expectColumn(Comment, "depth");
    expectColumn(Comment, "path");
    expectColumn(Comment, "moderationStatus");
    expectColumn(Comment, "deletedAt");
    expectNoColumn(Comment, "targetUnitId");

    expectColumn(ContentStructure, "ownerUnitId");
    expectNoColumn(ContentStructure, "targetUnitId");

    expectColumn(ContentStructureNode, "ownerUnitId");
    expectColumn(ContentStructureNode, "parentId");
    expectColumn(ContentStructureNode, "contentUnitId");
    expectColumn(ContentStructureNode, "position");
    expectNoColumn(ContentStructureNode, "targetUnitId");

    expectColumn(ContentStructureAnchor, "nodeId");
    expectColumn(ContentStructureAnchor, "ownerUnitId");
    expectColumn(ContentStructureAnchor, "contentUnitId");
    expectColumn(ContentStructureAnchor, "parentNodeId");
    expectColumn(ContentStructureAnchor, "path");
    expectColumn(ContentStructureAnchor, "positionPath");
    expectNoColumn(ContentStructureAnchor, "targetUnitId");
  });
});
