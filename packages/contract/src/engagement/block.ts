import { t } from "elysia";
import { userBriefSchema } from "../user/user";

// ============================================================
// USER-TO-USER BLOCKING
// 用户对用户的拉黑
// ============================================================

/**
 * A user the caller has blocked. Carries the blocked user's public brief plus
 * the time the block was created. Blocking hides the blocked user's content
 * from the blocker's feeds and prevents direct messages in either direction.
 * 调用方已拉黑的用户。携带被拉黑用户的公开简介以及拉黑创建的时间。
 * 拉黑会在拉黑方的信息流中隐藏被拉黑用户的内容，并阻止双向的私信。
 */
export const blockedUserSchema = t.Composite([
  userBriefSchema,
  t.Object({ blockedAt: t.String() }),
]);

export type BlockedUser = (typeof blockedUserSchema)["static"];

export const blockListResponseSchema = t.Object({
  items: t.Array(blockedUserSchema),
});

export type BlockListResponse = (typeof blockListResponseSchema)["static"];

export const createBlockBodySchema = t.Object({
  /**
   * The unitId of the user to block.
   * 要拉黑的用户的 unitId。
   */
  userId: t.String(),
});

export type CreateBlock = (typeof createBlockBodySchema)["static"];
