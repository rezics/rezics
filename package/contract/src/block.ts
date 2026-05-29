import { t } from "elysia";
import { userBriefSchema } from "./user";

// ============================================================
// USER-TO-USER BLOCKING
// ============================================================

/**
 * A user the caller has blocked. Carries the blocked user's public brief plus
 * the time the block was created. Blocking hides the blocked user's content
 * from the blocker's feeds and prevents direct messages in either direction.
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
  /** The unitId of the user to block. */
  userId: t.String(),
});

export type CreateBlock = (typeof createBlockBodySchema)["static"];
