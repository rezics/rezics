import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const schema = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Missing Prisma model ${name}`);
  return match[0];
}

function expectField(block: string, fieldName: string) {
  expect(block).toMatch(new RegExp(`\\n\\s*${fieldName}\\s+`));
}

function expectNoField(block: string, fieldName: string) {
  expect(block).not.toMatch(new RegExp(`\\n\\s*${fieldName}\\s+`));
}

describe("Unit target semantics in Prisma schema", () => {
  test("keeps targetUnitId as the only generic persisted Unit target column", () => {
    expectField(modelBlock("Unit"), "targetUnitId");

    for (const modelName of [
      "Post",
      "Subscription",
      "ModerationCase",
      "RealmModerationQueueItem",
      "ContentModerationState",
      "RealmContentModeration",
      "CommentPromotion",
    ]) {
      expectNoField(modelBlock(modelName), "targetUnitId");
    }
  });

  test("names non-canonical operation endpoints by their owning domain", () => {
    const subscription = modelBlock("Subscription");
    expectField(subscription, "subscribedUnitId");
    expect(subscription).toContain(
      "@@unique([subscriberUnitId, subscribedUnitId])",
    );
    expect(subscription).toContain("@@index([subscribedUnitId])");

    const moderationCase = modelBlock("ModerationCase");
    expectField(moderationCase, "targetKind");
    expectField(moderationCase, "targetId");
    expectField(moderationCase, "addressedUnitId");
    expect(moderationCase).toContain("@@index([targetKind, targetId])");
    expect(moderationCase).toContain("@@index([addressedUnitId, state])");

    const queueItem = modelBlock("RealmModerationQueueItem");
    expectField(queueItem, "targetKind");
    expectField(queueItem, "targetId");
    expectField(queueItem, "addressedUnitId");
    expect(queueItem).toContain("@@index([targetKind, targetId])");
    expect(queueItem).toContain("@@index([addressedUnitId, state])");

    const globalModeration = modelBlock("ContentModerationState");
    expectField(globalModeration, "moderatedUnitId");
    expect(globalModeration).toContain("moderatedUnitId String");

    const realmModeration = modelBlock("RealmContentModeration");
    expectField(realmModeration, "moderatedUnitId");
    expect(realmModeration).toContain("@@id([realmUnitId, moderatedUnitId])");
    expect(realmModeration).toContain("@@index([moderatedUnitId, state])");

    const promotion = modelBlock("CommentPromotion");
    expectField(promotion, "commentUnitId");
    expect(promotion).toContain("@@id([scopeUnitId, commentUnitId])");
  });

  test("keeps topology and structure fields out of canonical Unit targeting", () => {
    const comment = modelBlock("Comment");
    expectField(comment, "rootUnitId");
    expectField(comment, "realmUnitId");
    expectField(comment, "parentCommentUnitId");
    expectField(comment, "depth");
    expectField(comment, "path");
    expectNoField(comment, "targetUnitId");

    const structure = modelBlock("ContentStructure");
    expectField(structure, "ownerUnitId");
    expectNoField(structure, "targetUnitId");

    const node = modelBlock("ContentStructureNode");
    expectField(node, "ownerUnitId");
    expectField(node, "parentId");
    expectField(node, "contentUnitId");
    expectField(node, "position");
    expectNoField(node, "targetUnitId");

    const anchor = modelBlock("ContentStructureAnchor");
    expectField(anchor, "nodeId");
    expectField(anchor, "ownerUnitId");
    expectField(anchor, "contentUnitId");
    expectField(anchor, "parentNodeId");
    expectField(anchor, "path");
    expectField(anchor, "positionPath");
    expectNoField(anchor, "targetUnitId");
  });
});
