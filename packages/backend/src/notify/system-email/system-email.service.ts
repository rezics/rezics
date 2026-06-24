import type { SystemEmailBody } from "@rezics/contract";
import { emailTransport } from "../email/transport";
import { pickLocale, renderKind } from "../kinds";
import {
  createNotification,
  findSystemEmailDuplicate,
  refreshNotification,
} from "../notification/notification.service";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

interface NotifySystemAndEmailResult {
  success: true;
  notificationId: string;
  deduplicated: boolean;
}

/**
 * Fan out a system notification + email for a single user.
 *
 * Spec: `notify-system-email` (notifySystemAndEmail fan-out API). The call
 * never throws when the email channel fails — only the in-app row is
 * load-bearing for the caller's success contract.
 */
export async function notifySystemAndEmail(
  body: SystemEmailBody & { primaryEmail?: string | null },
): Promise<NotifySystemAndEmailResult> {
  const { userId, kind, payload, locale, primaryEmail } = body;
  const actorUserId =
    typeof payload?.actorUserId === "string"
      ? (payload.actorUserId as string)
      : null;
  const sourceUnitId =
    typeof payload?.sourceUnitId === "string"
      ? (payload.sourceUnitId as string)
      : null;
  const claimId =
    typeof payload?.claimId === "string" ? (payload.claimId as string) : kind;
  if (!sourceUnitId) {
    throw new Error("System email payload is missing sourceUnitId");
  }

  const extra = {
    kind,
    payload,
    locale: locale ?? null,
  };

  const since = new Date(Date.now() - DEDUP_WINDOW_MS);

  if (actorUserId) {
    const existing = await findSystemEmailDuplicate({
      recipientId: userId,
      kind,
      sourceUnitId,
      actorId: actorUserId,
      since,
    });

    if (existing) {
      const now = new Date();
      const refreshed = await refreshNotification({
        id: existing.id,
        createdAt: now,
        extra,
      });
      return {
        success: true,
        notificationId: refreshed.id,
        deduplicated: true,
      };
    }
  }

  const notification = await createNotification({
    recipientId: userId,
    actorId: actorUserId,
    kind,
    sourceUnitId,
    extra: { ...extra, claimId },
  });

  if (primaryEmail) {
    const safeLocale = pickLocale(locale);
    const render = renderKind(
      kind,
      (payload ?? {}) as Record<string, unknown>,
      safeLocale,
    );
    void emailTransport.send({
      to: primaryEmail,
      subject: render.emailSubject,
      text: render.emailText,
    });
  }

  return {
    success: true,
    notificationId: notification.id,
    deduplicated: false,
  };
}
