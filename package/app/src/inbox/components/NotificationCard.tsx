import type { NotificationItem } from "@rezics/contract";
import { Badge } from "@rezics/ui/shadcn";
import { cn } from "@/shared/utils/css-util";

export interface NotificationCardProps {
  item: NotificationItem;
  onClick?: () => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "reaction.like":
      return "liked";
    case "reaction.favorite":
      return "favorited";
    case "follow.new":
      return "followed you";
    case "comment.new":
      return "commented";
    case "mention.new":
      return "mentioned you";
    case "invitation.new":
      return "invited you";
    case "system.notice":
      return "system";
    default:
      return kind;
  }
}

export function NotificationCard({ item, onClick }: NotificationCardProps) {
  const extra = (item.extra ?? null) as
    | { unitTitle?: string; unitCover?: string }
    | null;
  const actorCount = item.actorIds.length;
  const actorSummary =
    actorCount === 0
      ? "Someone"
      : actorCount === 1
        ? "Someone"
        : `${actorCount} people`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors",
        "hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none",
        item.read ? "" : "bg-surface-subtle/40",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{actorSummary}</span>
          <span className="text-muted-foreground">{kindLabel(item.kind)}</span>
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
          {formatRelativeTime(item.latestAt)}
        </p>
      </div>
      {!item.read && (
        <span
          aria-label="unread"
          className="mt-2 size-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
