import { t } from "elysia";

// ============================================================
// DISPATCH TYPE ENUM
// 派发类型枚举
// ============================================================

export const DispatchType = {
  BOOK: "rezics:book",
  GAME: "rezics:game",
  MEDIA: "rezics:media",
} as const;
export type DispatchType = (typeof DispatchType)[keyof typeof DispatchType];

export const dispatchTypeSchema = t.Union([
  t.Literal(DispatchType.BOOK),
  t.Literal(DispatchType.GAME),
  t.Literal(DispatchType.MEDIA),
]);

// ============================================================
// DISPATCH RESULT ENVELOPE
// 派发结果信封
// ============================================================

export const dispatchResultSchema = t.Object({
  taskId: t.String(),
  project: t.String(),
  type: dispatchTypeSchema,
  unitId: t.Optional(t.String()),
  data: t.Record(t.String(), t.Unknown()),
});
export type DispatchResult = (typeof dispatchResultSchema)["static"];

// ============================================================
// DISPATCH SCOPE CONSTANTS
// 派发作用域常量
// ============================================================

export const DispatchScope = {
  DOMAIN: "dispatch",
  SESSION: "rezics-server-session",
  UNIT_UPDATE: "unit:update",
  UNIT_CREATE: "unit:create",
} as const;
