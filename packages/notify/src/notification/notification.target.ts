import type { NotificationTarget } from "@rezics/contract";

/**
 * Routing hints an emitter may attach to a notification's `extra` so the notify
 * service can resolve a deep-link `target` without re-deriving routes on the
 * client. All optional; absence yields no target (the card just marks read).
 */
interface NotificationRoutingHints {
  bookId?: string;
  nodeId?: string;
  contentUnitId?: string;
  profileSlug?: string;
  realmId?: string;
  realmTab?: string;
  anchor?: string;
}

function readHints(extra: unknown): NotificationRoutingHints {
  if (!extra || typeof extra !== "object") return {};
  return extra as NotificationRoutingHints;
}

/**
 * Resolve a notification's deep-link `target` from its kind and `extra` hints,
 * mirroring the link-selection policy in `app-product-navigation`:
 *
 * - a `nodeId` (chapter-scoped TOC ops, per-node reminders, restores, chapter
 *   replies/reactions, chapter moderation) → `/book/:bookId/node/:nodeId`, the
 *   sole canonical reading surface;
 * - a chapter Unit id with no book/node context → `/chapter/:contentUnitId`;
 * - follow → the actor's profile; realm events → the realm tab.
 *
 * Returns `undefined` when no hint resolves a route, so the card stays a plain
 * mark-read item. Emitters adopt deep links incrementally by attaching hints.
 */
export function buildNotificationTarget(
  kind: string,
  extra: unknown,
): NotificationTarget | undefined {
  const hints = readHints(extra);

  if (hints.bookId && hints.nodeId) {
    return {
      route: "/book/:bookId/node/:nodeId",
      params: { bookId: hints.bookId, nodeId: hints.nodeId },
      ...(hints.anchor ? { anchor: hints.anchor } : {}),
    };
  }

  if (hints.contentUnitId) {
    return {
      route: "/chapter/:contentUnitId",
      params: { contentUnitId: hints.contentUnitId },
      ...(hints.anchor ? { anchor: hints.anchor } : {}),
    };
  }

  if (kind.startsWith("follow.") && hints.profileSlug) {
    return { route: "/u/:userSlug", params: { userSlug: hints.profileSlug } };
  }

  if (kind.startsWith("member.") || kind.startsWith("announcement.")) {
    if (hints.realmId) {
      return {
        route: "/realm/:realmId",
        params: { realmId: hints.realmId },
        ...(hints.realmTab ? { anchor: hints.realmTab } : {}),
      };
    }
  }

  return undefined;
}
