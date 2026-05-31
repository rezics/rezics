import type { SystemEmailBody } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { emailTransport } from "../email/transport";
import { pickLocale, renderKind } from "../kinds";

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
    const existing = await prisma.notification.findFirst({
      where: {
        recipientId: userId,
        kind,
        sourceUnitId,
        actorId: actorUserId,
        createdAt: { gte: since },
        AND: [
          { extra: { path: ["kind"], equals: kind } },
          {
            extra: {
              path: ["payload", "actorUserId"],
              equals: actorUserId,
            },
          },
          {
            extra: { path: ["payload", "sourceUnitId"], equals: sourceUnitId },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const now = new Date();
      const refreshed = await prisma.notification.update({
        where: { id: existing.id },
        data: { createdAt: now, read: false, readAt: null, extra },
      });
      return {
        success: true,
        notificationId: refreshed.id,
        deduplicated: true,
      };
    }
  }

  const notification = await prisma.notification.create({
    data: {
      recipientId: userId,
      actorId: actorUserId,
      kind,
      sourceUnitId,
      extra: { ...extra, claimId },
    },
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
