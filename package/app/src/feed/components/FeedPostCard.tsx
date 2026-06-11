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
import { useNavigate } from "@tanstack/react-router";
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
import {
  ModerationBadge,
  moderationControlStateClass,
  PostAuthorHeader,
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "@/post";
import { reviewCardActions, reviewPolicy } from "@/review";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { VariantContextLink } from "@/unit";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface FeedPostCardTargetUnit {
  unitId: string;
  title: string;
}

export interface FeedPostCardMedia {
  alt?: string;
  src?: string | null;
}

export interface FeedPostCardProps {
  post: PostDTO;
  className?: string;
  title?: React.ReactNode;
  targetUnit?: FeedPostCardTargetUnit | null;
  variantContext?: VariantContextSummary | null;
  media?: FeedPostCardMedia;
  mediaSlot?: React.ReactNode;
  mediaMode?: "inline" | "forward";
  bodyLines?: number;
  titleLines?: number;
  href?: string;
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

/**
 * Feed previews own card navigation and truncation; full post/review surfaces
 * keep their richer detail behavior outside the feed stream.
 * 信息流预览自行负责卡片导航与截断；完整的帖子/评论页面
 * 在信息流之外保留其更丰富的详情行为。
 */
export function FeedPostCard({
  bodyLines = 4,
  className,
  media,
  mediaMode = "inline",
  mediaSlot,
  href,
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
}: FeedPostCardProps) {
  const { t } = useTranslation(["community"]);
  const navigate = useNavigate();
  const markdown = mainMarkdownSource(post.content) ?? "";
  const hasMedia = Boolean(mediaSlot || media?.src);
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const resolvedTitle = title ?? post.title;
  const replyToPost = () => {
    if (href) {
      navigate({
        to: href,
        search: { focus: "reply" },
      });
      return;
    }
    navigate({
      to: "/post/$rootPostUnitId",
      params: { rootPostUnitId: post.unitId },
      search: { focus: "reply" },
    });
  };

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
    onReplyInvoke: onReplyInvoke ?? replyToPost,
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

  const openPost = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    if (href) {
      navigate({ to: href });
      return;
    }
    switch (post.kind) {
      case PostKind.REVIEW:
        navigate({
          to: "/review/$reviewId",
          params: { reviewId: post.unitId },
        });
        return;
      case PostKind.REMARK:
        navigate({
          to: "/remark/$reviewId",
          params: { reviewId: post.unitId },
        });
        return;
      default:
        navigate({
          to: "/post/$rootPostUnitId",
          params: { rootPostUnitId: post.unitId },
        });
    }
  };

  return (
    <Card
      surface="plain"
      interactive
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform]",
        "hover:-translate-y-0.5",
        className,
      )}
      onClick={openPost}
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
            {manageMode && (realmModerationStatus || moderationMenuContent) ? (
              // biome-ignore lint/a11y/noStaticElementInteractions: this wrapper prevents nested moderation controls from triggering the parent card link.
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={() => undefined}
              >
                <ModerationBadge
                  at={realmModerationAt}
                  latestAction={moderationLatestAction}
                  post={post}
                  status={realmModerationStatus}
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
                          aria-label={t("community:realm_moderation_actions")}
                          className={cn(
                            "h-8 w-8 p-0 text-text-secondary",
                            moderationControlStateClass,
                          )}
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

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
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
