import type { CommentListContext } from "@rezics/contract";

/**
 * Pure comment-context rules shared by the thread selector, composers, and
 * context badges. Stays React-free so the rules remain unit-testable
 * (feature standard: `models/` must not import React, hooks, or states).
 * 评论语境的纯规则，供线程选择器、编辑器与语境徽章共用。保持无 React，
 * 以便规则可被单元测试（feature 规范：`models/` 禁止引用 React、hooks
 * 或 states）。
 */

export const COMMENT_CONTEXT_ALL: CommentListContext = { kind: "all" };

/**
 * Sentinel Select value for the All option. Realm options use the realm
 * unit id itself, which can never collide with this literal because unit
 * ids are opaque generated identifiers.
 * “全部”选项在 Select 中的哨兵值。realm 选项直接使用 realm unit id，
 * 由于 unit id 是不透明的生成标识符，不会与该字面量冲突。
 */
export const COMMENT_CONTEXT_ALL_OPTION_VALUE = "all";

/**
 * Zone context mirrors `ZoneConfigV1["context"]` structurally so this model
 * stays decoupled from the zone config envelope type.
 * 专区语境在结构上对应 `ZoneConfigV1["context"]`，以使该模型与专区配置
 * 信封类型解耦。
 */
export type CommentContextSurface =
  | {
      kind: "zone";
      zoneContext?:
        | { kind: "global" }
        | { kind: "realm"; realmUnitId: string }
        | null;
    }
  | { kind: "realm"; realmUnitId: string }
  | { kind: "direct" };

/**
 * Surface defaults: zone-framed routes follow the zone's configured
 * interaction context, realm routes default to their own realm's thread,
 * and direct unit routes read everything. `direct` is intentionally never
 * a user-facing default — it exists as an API/test context only.
 * 各界面默认值：专区路由跟随专区配置的交互语境，realm 路由默认读取自身
 * realm 的线程，直接 Unit 路由读取全部。`direct` 刻意不作为面向用户的
 * 默认值——它仅作为 API/测试语境存在。
 */
export function resolveDefaultCommentContext(
  surface: CommentContextSurface,
): CommentListContext {
  if (surface.kind === "realm") {
    return { kind: "realm", realmUnitId: surface.realmUnitId };
  }
  if (surface.kind === "zone" && surface.zoneContext?.kind === "realm") {
    return { kind: "realm", realmUnitId: surface.zoneContext.realmUnitId };
  }
  return COMMENT_CONTEXT_ALL;
}

/**
 * Ordered, de-duplicated realm option ids for the context selector. The
 * surface's pinned context realm always sorts first (right after All).
 * There is no UnitRealm reverse-lookup read endpoint yet, so callers feed
 * this with the realms the surface already knows plus the realms observed
 * on loaded comments.
 * 语境选择器的有序去重 realm 选项 id。界面置顶的语境 realm 始终排在最前
 * （紧跟“全部”之后）。目前没有 UnitRealm 反向查询端点，因此调用方需传入
 * 界面已知的 realm 以及已加载评论上观察到的 realm。
 */
export function buildCommentContextRealmOptions(input: {
  pinnedRealmUnitId?: string | null;
  knownRealmUnitIds?: readonly (string | null | undefined)[];
  observedRealmUnitIds?: readonly (string | null | undefined)[];
}): string[] {
  const ordered = [
    input.pinnedRealmUnitId,
    ...(input.knownRealmUnitIds ?? []),
    ...(input.observedRealmUnitIds ?? []),
  ];
  const unique: string[] = [];
  for (const realmUnitId of ordered) {
    if (!realmUnitId || unique.includes(realmUnitId)) continue;
    unique.push(realmUnitId);
  }
  return unique;
}

export function commentContextToOptionValue(
  context: CommentListContext,
): string {
  return context.kind === "realm"
    ? context.realmUnitId
    : COMMENT_CONTEXT_ALL_OPTION_VALUE;
}

export function commentContextFromOptionValue(
  value: string,
): CommentListContext {
  return value === COMMENT_CONTEXT_ALL_OPTION_VALUE
    ? COMMENT_CONTEXT_ALL
    : { kind: "realm", realmUnitId: value };
}

/**
 * Maps the selected read context to the required-nullable write target:
 * All → `null` (direct comment), realm view → that realm. The server
 * re-validates realm targets against the root unit's UnitRealm set.
 * 将选中的读取语境映射为必填可空的写入目标：全部 → `null`（直接评论），
 * realm 视图 → 该 realm。服务端会根据根 Unit 的 UnitRealm 集合重新校验
 * realm 目标。
 */
export function toCommentWriteRealmUnitId(
  context: CommentListContext,
): string | null {
  return context.kind === "realm" ? context.realmUnitId : null;
}

export type CommentContextBadge =
  | { kind: "realm"; realmUnitId: string }
  | { kind: "direct" };

/**
 * Badges only disambiguate the mixed All view; single-context views are
 * already labeled by the selector itself, so they never badge.
 * 徽章仅用于区分混合的“全部”视图；单一语境视图已由选择器本身标示，
 * 因此从不显示徽章。
 */
export function decideCommentContextBadge(input: {
  viewContext: CommentListContext;
  commentRealmUnitId: string | null | undefined;
}): CommentContextBadge | null {
  if (input.viewContext.kind !== "all") return null;
  if (input.commentRealmUnitId) {
    return { kind: "realm", realmUnitId: input.commentRealmUnitId };
  }
  return { kind: "direct" };
}
