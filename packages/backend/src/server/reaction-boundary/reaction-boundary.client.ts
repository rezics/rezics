import type {
  AllowedReactionKind,
  GivenResponse,
  InternalByUserBody,
  InternalByUserResponse,
  InternalCreateResponse,
  InternalCreateShareResponse,
  InternalRemoveResponse,
} from "@rezics/contract/reaction";
import { normalizeReactionContextUnitId } from "@rezics/contract/reaction";

async function getReactionService() {
  const { reactionService } = await import(
    "../../reaction/reaction/reaction.service"
  );
  return reactionService;
}

function parseReactionFilter(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/**
 * Create a reaction through the in-process reaction service.
 * Returns the reaction DTO and whether it was newly created.
 */
export async function createReaction(
  userId: string,
  targetId: string,
  reaction: AllowedReactionKind,
  contextUnitId?: string | null,
): Promise<InternalCreateResponse> {
  const service = await getReactionService();
  const result = await service.create(
    userId,
    targetId,
    reaction,
    normalizeReactionContextUnitId(contextUnitId),
  );
  const row = result.reaction;
  return {
    id: row.id,
    userId: row.userId,
    targetId: row.targetId,
    reaction: row.reaction as AllowedReactionKind,
    contextUnitId: row.contextUnitId,
    createdAt: row.createdAt.toISOString(),
    created: result.created,
  };
}

/**
 * Remove a reaction through the in-process reaction service.
 */
export async function removeReaction(
  userId: string,
  targetId: string,
  reaction: AllowedReactionKind,
  contextUnitId?: string | null,
): Promise<InternalRemoveResponse> {
  const service = await getReactionService();
  return service.remove(
    userId,
    targetId,
    reaction,
    normalizeReactionContextUnitId(contextUnitId),
  );
}

export async function recordShare(
  userId: string,
  targetId: string,
): Promise<InternalCreateShareResponse> {
  const service = await getReactionService();
  return service.recordShare(userId, targetId);
}

/**
 * List a user's own reaction events through the in-process reaction service.
 * Used by the profile Given view; the main server is responsible for any
 * privacy gating before calling this.
 */
export async function listGivenReactions(query: {
  userId: string;
  reactions?: string;
  contextUnitId?: string | null;
  cursor?: string;
  limit?: number;
}): Promise<GivenResponse> {
  const service = await getReactionService();
  return service.listGiven({
    userId: query.userId,
    reactions: parseReactionFilter(query.reactions),
    contextUnitId:
      query.contextUnitId === undefined
        ? undefined
        : normalizeReactionContextUnitId(query.contextUnitId),
    cursor: query.cursor,
    limit: query.limit,
  });
}

/**
 * List reactions on a given target id set through the in-process reaction
 * service. Used by the profile Received view.
 */
export async function listByUser(
  body: InternalByUserBody,
): Promise<InternalByUserResponse> {
  const service = await getReactionService();
  return service.listByUser(body);
}

/**
 * Delete all reactions for a target through the in-process reaction service.
 * Used when a Unit is deleted. Fire-and-forget — does not throw.
 */
export async function cleanupReactions(
  targetId: string,
): Promise<{ ok: boolean }> {
  try {
    const service = await getReactionService();
    await service.cleanupTarget(targetId);
    return { ok: true };
  } catch (e) {
    console.error("[reaction-boundary] Cleanup call failed:", e);
    return { ok: false };
  }
}
