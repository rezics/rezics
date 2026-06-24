/**
 * Pure visibility gate for in-thread promotion controls. Mirrors the server's
 * promotion rules so a shown control virtually always succeeds; the server gate
 * (`assertCanPromoteInThread`) remains the single source of truth. No React or
 * state imports — this is the testable decision the `CommentThreadSection` overflow
 * callback consumes.
 * 线程内提升控件的纯可见性门控。镜像服务端的提升规则，使展示出来的控件几乎总能
 * 成功；服务端门控（`assertCanPromoteInThread`）仍是唯一真实来源。不导入 React 或
 * 状态模块——这是 `CommentThreadSection` 溢出回调所消费的可测试决策。
 */
export interface PromotionGateInput {
  /** Server-derived: may the viewer pin/accept in this thread. 服务端推导：该浏览者是否可在此线程内置顶/采纳。 */
  viewerCanPromote: boolean;
  /** Server-derived: does the thread root bear the official question tag. 服务端推导：线程根是否带有官方的问题标签。 */
  isQuestionThread: boolean;
  /** Whether there is a current user session (anonymous → no controls). 是否存在当前用户会话（匿名 → 无控件）。 */
  hasSession: boolean;
  /** Depth of the target reply within the thread (root is `0`). 目标回复在线程内的深度（根为 `0`）。 */
  depth: number;
}

export interface PromotionGate {
  /** Pin/unpin may render: authorized viewer on any reply (`depth >= 1`). 置顶/取消置顶可渲染：已授权浏览者在任意回复上（`depth >= 1`）。 */
  canPin: boolean;
  /** Accept/unaccept may render: authorized viewer, Q&A thread, direct reply. 采纳/取消采纳可渲染：已授权浏览者、问答线程、直接回复。 */
  canAccept: boolean;
}

export function decidePromotionControls({
  viewerCanPromote,
  isQuestionThread,
  hasSession,
  depth,
}: PromotionGateInput): PromotionGate {
  const authorized = viewerCanPromote && hasSession;
  return {
    canPin: authorized && depth >= 1,
    canAccept: authorized && isQuestionThread && depth === 1,
  };
}
