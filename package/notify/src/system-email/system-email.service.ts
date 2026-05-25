import { type SystemEmailBody, SystemEmailKind } from "@rezics/contract";
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
  const claimerUserId =
    typeof payload?.claimerUserId === "string"
      ? (payload.claimerUserId as string)
      : null;
  const workUnitId =
    typeof payload?.workUnitId === "string"
      ? (payload.workUnitId as string)
      : null;
  const claimId =
    typeof payload?.claimId === "string" ? (payload.claimId as string) : kind;
  if (!workUnitId) {
    throw new Error("System email payload is missing workUnitId");
  }

  const extra = {
    kind,
    payload,
    locale: locale ?? null,
  };

  const isPendingWithDedup =
    kind === SystemEmailKind.WORK_LINK_CLAIM_PENDING &&
    claimerUserId !== null &&
    workUnitId !== null;

  const since = new Date(Date.now() - DEDUP_WINDOW_MS);

  if (isPendingWithDedup) {
    const existing = await prisma.notification.findFirst({
      where: {
        recipientId: userId,
        kind,
        sourceUnitId: workUnitId,
        actorId: claimerUserId,
        createdAt: { gte: since },
        AND: [
          { extra: { path: ["kind"], equals: kind } },
          {
            extra: {
              path: ["payload", "claimerUserId"],
              equals: claimerUserId,
            },
          },
          { extra: { path: ["payload", "workUnitId"], equals: workUnitId } },
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
      actorId: claimerUserId,
      kind,
      sourceUnitId: workUnitId,
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
