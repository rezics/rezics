/**
 * Engagement atom types.
 *
 * The unified `ReactionBar` is driven by two primitives:
 * - `Action` tokens enumerate which interactions a surface renders.
 * - `ActionPolicy` packages the visible order plus any overflow-menu fallback.
 */

/**
 * Action tokens consumed by `ReactionBar`.
 *
 * `"funny"` and `"award"` are reserved tokens and SHALL NOT render any UI in
 * this change. They exist so future work can enable them without renaming or
 * re-typing call sites.
 */
export type Action =
  | "vote"
  | "reply"
  | "share"
  | "shelf"
  | "more"
  | "funny"
  | "award";

/**
 * Per-surface action policy.
 *
 * Rules:
 * - Unknown tokens SHALL be silently ignored by the bar.
 * - If a token appears in BOTH `actions` and `overflow`, the visible placement
 *   wins (i.e. it is rendered inline and dropped from the overflow menu).
 * - Order of `actions` defines render order.
 */
export type ActionPolicy = {
  actions: Action[];
  overflow?: Action[];
};

/**
 * Visual size of the engagement atoms. Maps to icon sizing, button padding,
 * and label typography scale at the atom level.
 */
export type EngagementSize = "sm" | "md" | "lg";

// Canonical icon pixel sizes for engagement atoms — single source of truth.
// engagement 原子的标准图标像素尺寸——唯一来源。
export const ENGAGEMENT_ICON_PX: Record<EngagementSize, number> = {
  sm: 16,
  md: 18,
  lg: 22,
};

/**
 * Visual treatment for `ReactionBar`.
 *
 * - `"plain"`  — naked icon-button row, transparent chrome. Use inline next to
 *   meta info (e.g. `BookHeroSection` right rail).
 * - `"pill"`   — atoms share one rounded capsule that blends with the host
 *   card surface (no brand-tinted fills). Use inside discussion / list cards.
 */
export type ReactionBarVariant = "plain" | "pill";
