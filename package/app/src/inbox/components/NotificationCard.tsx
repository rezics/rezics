import type { NotificationItem } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge } from "@rezics/ui/shadcn";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { resolveNotificationHref } from "../models/notificationTarget";

export interface NotificationCardProps {
  item: NotificationItem;
  /** Invoked on activation (e.g. mark-as-read); navigation happens via target. */
  onClick?: () => void;
}

type Translate = ReturnType<typeof useTranslation>["t"];

/** Map a notification kind to its (literal) community message, i18n-resolved. */
function kindLabel(t: Translate, kind: string): string {
  switch (kind) {
    case "reaction.like":
      return t("community:notification_kind_reaction_like");
    case "reaction.favorite":
      return t("community:notification_kind_reaction_favorite");
    case "follow.new":
      return t("community:notification_kind_follow");
    case "comment.new":
      return t("community:notification_kind_reply");
    case "mention.new":
      return t("community:notification_kind_mention");
    case "invitation.new":
      return t("community:notification_kind_realm_invite");
    case "system.notice":
      return t("community:notification_kind_system");
    default:
      return kind;
  }
}

function relativeTime(t: Translate, iso: string): string {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return t("community:notification_time_now");
  if (minutes < 60)
    return t("community:notification_time_minutes", { value: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return t("community:notification_time_hours", { value: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("community:notification_time_days", { value: days });
  return date.toLocaleDateString();
}

export function NotificationCard({ item, onClick }: NotificationCardProps) {
  const { t } = useTranslation(["community"]);
  const extra = (item.extra ?? null) as {
    unitTitle?: string;
    unitCover?: string;
  } | null;
  const actorCount = item.actorIds.length;
  const actorSummary =
    actorCount > 1
      ? t("community:notification_actor_others", { count: actorCount })
      : t("community:notification_actor_fallback");

  const kindText = kindLabel(t, item.kind);

  const href = resolveNotificationHref(item);
  const className = cn(
    "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors",
    "hover:bg-surface-subtle focus-visible:bg-surface-subtle",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
    item.read ? "" : "bg-surface-subtle/40",
  );

  const body = (
    <>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{actorSummary}</span>
          <span className="text-muted-foreground">{kindText}</span>
          {item.count > 1 && (
            <Badge variant="secondary" className="ml-1">
              ×{item.count}
            </Badge>
          )}
        </div>
        {extra?.unitTitle && (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {extra.unitTitle}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {relativeTime(t, item.latestAt)}
        </p>
      </div>
      {!item.read && (
        <>
          {/* Unread state is also exposed as text so it is not conveyed by
              color/position alone. */}
          <span className="sr-only">{t("community:notification_unread")}</span>
          <span
            aria-hidden="true"
            className="mt-2 size-2 shrink-0 rounded-full bg-primary"
          />
        </>
      )}
    </>
  );

  // When the server resolved a deep-link target, the card navigates there and
  // still marks itself read on activation; otherwise it is a plain mark-read
  // button.
  if (href) {
    return (
      <Link to={href} onClick={onClick} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
