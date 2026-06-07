import {
  extractPollUnitIdsFromContentDoc,
  type ModerationActionDTO,
  type ModerationStatus,
  mainMarkdownSource,
  type PostDTO,
  PostKind,
  type VariantContextSummary,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import {
  Button,
  Card,
  CardMedia,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Shield, Star } from "lucide-react";
import type React from "react";
import {
  type Action,
  type ActionPolicy,
  type EngagementSize,
  ReactionActionRow,
  type ReactionBarPolicy,
  ReactionOverflowMenu,
  useReactionBarModel,
} from "@/engagement";
import { PollEmbed } from "@/poll";
import { PostAuthorHeader } from "@/post";
import { PostAuthorAvatar } from "@/post/components/parts/PostAuthorHeader";
import {
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "@/post/models/postPolicy";
import { reviewCardActions, reviewPolicy } from "@/review/models/reviewPolicy";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { VariantContextLink } from "@/unit";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface FeedCardTargetUnit {
  unitId: string;
  title: string;
}

export interface FeedCardMedia {
  alt?: string;
  src?: string | null;
}

export interface FeedCardProps {
  post: PostDTO;
  className?: string;
  title?: React.ReactNode;
  targetUnit?: FeedCardTargetUnit | null;
  variantContext?: VariantContextSummary | null;
  media?: FeedCardMedia;
  mediaSlot?: React.ReactNode;
  mediaMode?: "inline" | "forward";
  bodyLines?: number;
  titleLines?: number;
  onOpen?: () => void;
  onReplyInvoke?: () => void;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  reactionSize?: EngagementSize;
  reactionActions?: Action[];
  reactionOverflow?: Action[];
  reactionActionPolicy?: ActionPolicy;
  reactionPolicy?: ReactionBarPolicy;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

type CommunityT = ReturnType<typeof useTranslation>["t"];

type StatusBadge = {
  key: string;
  label: string;
  tone: "success" | "warning" | "error";
};

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

function statusDotClass(tone: StatusBadge["tone"]) {
  switch (tone) {
    case "success":
      return "bg-success-fill";
    case "warning":
      return "bg-warning-fill";
    case "error":
      return "bg-error-fill";
  }
}

function formatRelativeTime(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

function moderationLatestActionLabel(
  t: CommunityT,
  action: ModerationActionDTO,
) {
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

function moderationActorLabel(t: CommunityT, action: ModerationActionDTO) {
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

function moderationLatestActionDetail(
  t: CommunityT,
  action?: ModerationActionDTO | null,
) {
  if (action === undefined) return null;
  if (!action) return t("community:moderation_auto_approved");

  const reason = action.reasonText ?? action.publicMessage ?? null;
  const detail = t("community:moderation_latest_action_detail", {
    action: moderationLatestActionLabel(t, action),
    actor: moderationActorLabel(t, action),
  });
  if (!reason) return detail;

  return `${detail} - ${t("community:moderation_decision_reason_prefix", {
    reason,
  })}`;
}

function ModerationStatusBadge({
  post,
  statuses,
  at,
}: {
  post: PostDTO;
  statuses: StatusBadge[];
  at?: string | Date | null;
}) {
  if (statuses.length === 0) return null;
  const [primary, secondary] = statuses;
  const relativeTime = formatRelativeTime(at);

  return (
    <div
      className="flex min-w-0 shrink-0 items-center gap-2"
      title={statuses.map((status) => status.label).join(", ")}
    >
      <div className="relative shrink-0">
        <PostAuthorAvatar
          post={post}
          size="compact"
          className="size-8 rounded-full"
        />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface-canvas",
            statusDotClass(primary.tone),
          )}
        />
        {secondary ? (
          <span
            className={cn(
              "absolute -right-1 top-0 size-2.5 rounded-full border border-surface-canvas",
              statusDotClass(secondary.tone),
            )}
          />
        ) : null}
      </div>
      <span className="truncate text-xs leading-ui text-text-secondary">
        {primary.label}
        {relativeTime ? ` ${relativeTime}` : ""}
      </span>
    </div>
  );
}

function FeedReviewRating({ post }: { post: PostDTO }) {
  const rating = (post.extra as { rating?: number } | null)?.rating;
  if (post.kind !== PostKind.REVIEW) return null;

  return (
    <TextLink
      to="/review/$reviewId"
      params={{ reviewId: post.unitId }}
      className="flex items-center gap-1 rounded p-1 text-inherit no-underline transition-colors hover:bg-surface-subtle"
      onClick={(event) => event.stopPropagation()}
    >
      <Star className="h-4 w-4 fill-current text-text-brand" aria-hidden />
      <span className="text-xs leading-dense">
        {rating !== undefined ? rating.toFixed(1) : "0.0"}/10
      </span>
    </TextLink>
  );
}

/**
 * Feed previews own card navigation and truncation; full post/review surfaces
 * keep their richer detail behavior outside the feed stream.
 */
export function FeedCard({
  bodyLines = 4,
  className,
  media,
  mediaMode = "inline",
  mediaSlot,
  moderationLatestAction,
  moderationMenuContent,
  onOpen,
  onReplyInvoke,
  post,
  reactionActionPolicy,
  reactionActions = post.kind === PostKind.REVIEW
    ? reviewCardActions
    : postCardActions,
  reactionOverflow = post.kind === PostKind.REVIEW ? [] : postCardOverflow,
  reactionPolicy = post.kind === PostKind.REVIEW ? reviewPolicy : postPolicy,
  reactionScopeKey,
  reactionSize = "md",
  realmModerationAt,
  realmModerationStatus,
  summaryScopeKey,
  targetUnit,
  title,
  titleLines = 2,
  variantContext,
  manageMode = false,
}: FeedCardProps) {
  const { t } = useTranslation(["community"]);
  const markdown = mainMarkdownSource(post.content) ?? "";
  const hasMedia = Boolean(mediaSlot || media?.src);
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const resolvedTitle = title ?? post.title;
  const moderationDetail = manageMode
    ? moderationLatestActionDetail(t, moderationLatestAction)
    : null;
  const statusBadges = [
    realmModerationStatus
      ? {
          key: "relation-moderation",
          label:
            realmModerationStatus === "pending"
              ? t("community:moderation_status_pending")
              : realmModerationStatus === "approved"
                ? t("community:moderation_status_approved")
                : t("community:moderation_status_removed"),
          tone:
            realmModerationStatus === "approved"
              ? "success"
              : realmModerationStatus === "pending"
                ? "warning"
                : "error",
        }
      : null,
  ].filter(Boolean) as StatusBadge[];

  const reactionModel = useReactionBarModel({
    size: reactionSize,
    variant: "pill",
    post,
    policy: reactionPolicy,
    summaryScopeKey,
    reactionScopeKey,
    actions: reactionActions,
    overflow: reactionOverflow,
    actionPolicy: reactionActionPolicy,
    onReplyInvoke,
  });

  const mediaNode =
    mediaSlot ??
    (media?.src ? (
      <img
        src={media.src}
        alt={media.alt ?? ""}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    ) : null);

  return (
    <Card
      surface="plain"
      interactive={Boolean(onOpen)}
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform]",
        onOpen && "hover:-translate-y-0.5",
        className,
      )}
      onClick={onOpen}
    >
      <article
        className={cn(
          "flex min-w-0 gap-4 p-3",
          mediaMode === "forward" && "flex-col gap-3",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <PostAuthorHeader post={post} />
            </div>
            <FeedReviewRating post={post} />
          </div>

          {resolvedTitle ? (
            <h3
              className="m-0 text-base font-medium leading-ui text-text-primary"
              style={clampStyle(titleLines)}
            >
              {resolvedTitle}
            </h3>
          ) : null}

          {targetUnit ? (
            <div className="flex min-w-0 items-center gap-1 text-xs leading-dense text-text-secondary">
              <span className="shrink-0">
                {t("community:review_target_label")}
              </span>
              <TextLink
                to="/book/$bookId"
                params={{ bookId: targetUnit.unitId }}
                underline="none"
                className="min-w-0 truncate text-text-secondary hover:text-text-primary"
                onClick={(event) => event.stopPropagation()}
              >
                {targetUnit.title}
              </TextLink>
            </div>
          ) : null}

          <div
            className="text-sm leading-ui text-text-secondary"
            style={clampStyle(bodyLines)}
          >
            <MarkdownContent content={markdown} />
          </div>

          {resolvedVariantContext ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents parent feed card navigation when the nested route link is used.
            <div
              className="w-fit max-w-full"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={() => undefined}
            >
              <VariantContextLink context={resolvedVariantContext} />
            </div>
          ) : null}

          {pollUnitIds.map((pollUnitId) => (
            <PollEmbed
              key={pollUnitId}
              pollUnitId={pollUnitId}
              realmUnitId={post.realmUnitId}
            />
          ))}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <ReactionActionRow model={reactionModel} />
              <ReactionOverflowMenu
                model={reactionModel}
                className="hidden sm:block"
              />
            </div>
            {manageMode &&
            (statusBadges.length > 0 || moderationMenuContent) ? (
              // biome-ignore lint/a11y/noStaticElementInteractions: this wrapper prevents nested moderation controls from triggering the parent card link.
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={() => undefined}
              >
                <ModerationStatusBadge
                  post={post}
                  statuses={statusBadges}
                  at={realmModerationAt}
                />
                {moderationMenuContent ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      nativeButton
                      render={(props) => (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Realm moderation actions"
                          className="h-8 w-8 p-0 text-text-secondary"
                          {...props}
                        >
                          <Shield className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    />
                    <DropdownMenuContent
                      align="end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {moderationMenuContent}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>
          <ReactionOverflowMenu
            model={reactionModel}
            className="absolute right-2 top-2 z-10 sm:hidden"
          />
          {moderationDetail ? (
            <p className="m-0 truncate text-xs leading-dense text-text-tertiary">
              {moderationDetail}
            </p>
          ) : null}
        </div>

        {hasMedia ? (
          <CardMedia
            className={cn(
              "rounded-sm bg-surface-subtle",
              mediaMode === "forward"
                ? "aspect-[16/9]"
                : "hidden h-24 w-32 shrink-0 sm:block",
            )}
          >
            {mediaNode}
          </CardMedia>
        ) : null}
      </article>
    </Card>
  );
}
