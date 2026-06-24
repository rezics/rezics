import type {
  ModerationActionDTO,
  ModerationStatus,
  PostDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@rezics/ui/shadcn";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

type TranslationT = ReturnType<typeof useTranslation>["t"];

type StatusTone = "success" | "warning" | "error";

export const moderationControlStateClass =
  "bg-transparent transition-colors hover:!bg-surface-sunken focus-visible:!bg-surface-sunken data-open:!bg-surface-sunken data-popup-open:!bg-surface-sunken aria-expanded:!bg-surface-sunken";

export function ModerationBadge({
  at,
  latestAction,
  post,
  status,
}: {
  at?: string | Date | null;
  latestAction?: ModerationActionDTO | null;
  post: PostDTO;
  status?: ModerationStatus;
}) {
  const { t } = useTranslation(["common", "community"]);
  if (!status) return null;

  const label = badgeLabel(t, status, latestAction);
  const relativeTime = latestAction
    ? formatRelativeTime(t, latestAction.createdAt)
    : formatRelativeTime(t, at);
  const showActorAvatar = Boolean(latestAction);

  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        className={cn(
          "flex min-w-0 shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
          moderationControlStateClass,
        )}
        title={label}
      >
        {showActorAvatar ? (
          <div className="relative shrink-0">
            <ModerationActorAvatar action={latestAction} post={post} />
            <span
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface-canvas",
                statusDotClass(statusTone(status)),
              )}
            />
          </div>
        ) : null}
        <span className="truncate text-xs leading-ui text-text-secondary">
          {label}
          {relativeTime ? ` ${relativeTime}` : ""}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 gap-3 rounded-md p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle className="text-sm leading-ui">
            {t("community:moderation_previous_actions_title")}
          </PopoverTitle>
        </PopoverHeader>
        <ModerationActionListItem action={latestAction} post={post} />
      </PopoverContent>
    </Popover>
  );
}

function statusDotClass(tone: StatusTone) {
  switch (tone) {
    case "success":
      return "bg-success-fill";
    case "warning":
      return "bg-warning-fill";
    case "error":
      return "bg-error-fill";
  }
}

/**
 * Format a date as a human-readable relative time string.
 * 将日期格式化为可读的相对时间字符串。
 */
function formatRelativeTime(t: TranslationT, value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return t("common:relative_time_just_now");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return t("common:relative_time_minutes_ago", { value: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common:relative_time_hours_ago", { value: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("common:relative_time_days_ago", { value: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("common:relative_time_weeks_ago", { value: weeks });
  return date.toLocaleDateString();
}

function moderationActionLabel(t: TranslationT, action: ModerationActionDTO) {
  switch (action.actionKind) {
    case "approve":
      return t("community:moderation_latest_action_approve");
    case "remove":
      return t("community:moderation_latest_action_remove");
    case "restore":
      return t("community:moderation_latest_action_restore");
    case "lock":
      return t("community:moderation_latest_action_lock");
    case "unlock":
      return t("community:moderation_latest_action_unlock");
    default:
      return action.actionKind.replaceAll("_", " ");
  }
}

function statusLabel(t: TranslationT, status: ModerationStatus) {
  switch (status) {
    case "pending":
      return t("community:moderation_status_pending");
    case "approved":
      return t("community:moderation_status_approved");
    case "removed":
      return t("community:moderation_status_removed");
  }
}

function statusTone(status: ModerationStatus): StatusTone {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "removed":
      return "error";
  }
}

function moderationActorLabel(t: TranslationT, action: ModerationActionDTO) {
  if (action.actorUserId) return `@${action.actorUserId}`;
  switch (action.actorKind) {
    case "system":
      return t("community:moderation_actor_system");
    case "automation":
      return t("community:moderation_actor_automation");
    case "import":
      return t("community:moderation_actor_import");
    case "user":
      return t("community:moderation_actor_unknown_user");
  }
}

function badgeLabel(
  t: TranslationT,
  status: ModerationStatus,
  latestAction?: ModerationActionDTO | null,
) {
  if (latestAction) return moderationActionLabel(t, latestAction);
  if (status === "approved") return t("community:moderation_auto_approved");
  return statusLabel(t, status);
}

function ModerationActorAvatar({
  action,
  post,
}: {
  action?: ModerationActionDTO | null;
  post: PostDTO;
}) {
  const actorIsPostAuthor =
    action?.actorUserId && action.actorUserId === post.author?.unitId;
  const fallback =
    (actorIsPostAuthor
      ? post.author?.name?.slice(0, 2)
      : action?.actorUserId?.slice(0, 2)
    )?.toUpperCase() ?? "RU";

  return (
    <Avatar className="size-8">
      {actorIsPostAuthor ? (
        <AvatarImage src={post.author?.avatar ?? undefined} />
      ) : null}
      <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
    </Avatar>
  );
}

function ModerationActionListItem({
  action,
  post,
}: {
  action?: ModerationActionDTO | null;
  post: PostDTO;
}) {
  const { t } = useTranslation(["common", "community"]);
  const label = action
    ? moderationActionLabel(t, action)
    : t("community:moderation_auto_approved");
  const actor = action ? moderationActorLabel(t, action) : null;
  const time = formatRelativeTime(t, action?.createdAt);
  const reason = action?.reasonText ?? action?.publicMessage ?? null;

  return (
    <div className="flex gap-3">
      {action?.actorUserId ? (
        <Link
          to="/user/$userId"
          params={{ userId: action.actorUserId }}
          className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <ModerationActorAvatar action={action} post={post} />
        </Link>
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center">
          <span
            className={cn(
              "size-3 rounded-full",
              statusDotClass(
                action?.resultingStatus
                  ? statusTone(action.resultingStatus)
                  : "success",
              ),
            )}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-ui text-text-primary">
          {label}
        </div>
        {actor || time ? (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-xs leading-dense text-text-secondary">
            {action?.actorUserId ? (
              <Link
                to="/user/$userId"
                params={{ userId: action.actorUserId }}
                className="truncate text-link no-underline hover:underline"
              >
                {actor}
              </Link>
            ) : actor ? (
              <span>{actor}</span>
            ) : null}
            {actor && time ? <span aria-hidden>·</span> : null}
            {time ? <span>{time}</span> : null}
          </div>
        ) : null}
        {reason ? (
          <p className="mt-1 m-0 text-xs leading-ui text-text-tertiary">
            {t("community:moderation_decision_reason_prefix", { reason })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
