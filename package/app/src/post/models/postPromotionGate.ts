/**
 * Pure visibility gate for in-thread promotion controls. Mirrors the server's
 * promotion rules so a shown control virtually always succeeds; the server gate
 * (`assertCanPromoteInThread`) remains the single source of truth. No React or
 * state imports — this is the testable decision the `PostTreeSection` overflow
 * callback consumes.
 */
export interface PromotionGateInput {
  /** Server-derived: may the viewer pin/accept in this thread. */
  viewerCanPromote: boolean;
  /** Server-derived: does the thread root bear the official question tag. */
  isQuestionThread: boolean;
  /** Whether there is a current user session (anonymous → no controls). */
  hasSession: boolean;
  /** Depth of the target reply within the thread (root is `0`). */
  depth: number;
}

export interface PromotionGate {
  /** Pin/unpin may render: authorized viewer on any reply (`depth >= 1`). */
  canPin: boolean;
  /** Accept/unaccept may render: authorized viewer, Q&A thread, direct reply. */
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
