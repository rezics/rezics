import { useReactionHydration } from "@rezics/contract/api/reaction/reaction";
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
import { useMemo } from "react";
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

const EMPTY_REACTION_TARGET_IDS: readonly string[] = [];

export interface StreamPostCardTargetUnit {
  unitId: string;
  title: string;
  coverUrl?: string | null;
}

export interface StreamPostCardMedia {
  alt?: string;
  src?: string | null;
}

export interface StreamPostCardProps {
  post: PostDTO;
  className?: string;
  title?: React.ReactNode;
  targetUnit?: StreamPostCardTargetUnit | null;
  variantContext?: VariantContextSummary | null;
  media?: StreamPostCardMedia;
  mediaSlot?: React.ReactNode;
  mediaMode?: "inline" | "forward";
  bodyLines?: number;
  titleLines?: number;
  /** Override the default post detail route. 覆盖默认的帖子详情路由。 */
  href?: string;
  onReplyInvoke?: () => void;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  reactionSize?: EngagementSize;
  reactionActions?: Action[];
  reactionOverflow?: Action[];
  reactionActionPolicy?: ActionPolicy;
  reactionPolicy?: ReactionBarPolicy;
  /**
   * Direct card usages hydrate their own reaction cache. Stream renderers batch
   * hydration and disable this per-card fallback to avoid duplicate requests.
   * 直接使用卡片时由卡片自行预热 reaction cache。Stream renderer 会批量
   * 预热，并关闭这个单卡 fallback 以避免重复请求。
   */
  hydrateReaction?: boolean;
  manageMode?: boolean;
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  moderationMenuContent?: React.ReactNode;
}

/**
 * Stream post card：信息流预览自行负责卡片导航与截断；完整的帖子/评论
 * 页面在信息流之外保留更丰富的详情行为。窄屏时正文列 `min-w-0` 截断，
 * 媒体前置模式改为纵向；宽屏时媒体固定宽度，正文伸展。Reaction row
 * 是独立交互区，点击或键盘触发都不打开卡片。
 *
 * Mobile (<640px)
 * +------------------------------+
 * | Author / rating              |
 * | Title two lines              |
 * | Body preview                 |
 * | (optional media)             |
 * | [vote][reply][share][more]   |
 * +------------------------------+
 *
 * Tablet (640px-1023px)
 * +--------------------------------------+
 * | Author                         Media |
 * | Title / target / body preview        |
 * | Reaction row anchored to bottom      |
 * +--------------------------------------+
 *
 * Desktop (1024px-1535px)
 * +------------------------------------------------+
 * | Content column stretches, media fixed if shown |
 * | Footer stays at card bottom below short content |
 * +------------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +----------------------------------------------------------+
 * | Card width is inherited from stream container constraints   |
 * +----------------------------------------------------------+
 */
export function StreamPostCard({
  bodyLines = 4,
  className,
  media,
  mediaMode = "inline",
  mediaSlot,
  href,
  hydrateReaction = true,
  moderationLatestAction,
  moderationMenuContent,
  onReplyInvoke,
  post,
  reactionActionPolicy,
  reactionActions = post.kind === PostKind.REVIEW
    ? reviewCardActions
    : postCardActions,
  reactionOverflow = post.kind === PostKind.REVIEW ? [] : postCardOverflow,
  reactionPolicy = post.kind === PostKind.REVIEW ? reviewPolicy : postPolicy,
  reactionContextUnitId,
  reactionSize = "md",
  realmModerationAt,
  realmModerationStatus,
  summaryContextUnitId,
  targetUnit,
  title,
  titleLines = 2,
  variantContext,
  manageMode = false,
}: StreamPostCardProps) {
  const { t } = useTranslation(["community"]);
  const navigate = useNavigate();
  const markdown = mainMarkdownSource(post.content) ?? "";
  const hasMedia = Boolean(mediaSlot || media?.src);
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const resolvedTitle = title ?? post.title;
  const reactionTargetIds = useMemo(
    () =>
      hydrateReaction && post.unitId
        ? [post.unitId]
        : EMPTY_REACTION_TARGET_IDS,
    [hydrateReaction, post.unitId],
  );

  useReactionHydration(reactionTargetIds, {
    summaryContextUnitId: summaryContextUnitId ?? null,
    userContextUnitId: reactionContextUnitId ?? null,
  });

  // Compute the canonical detail href from post kind.
  // 根据帖子类型计算规范的详情页链接。
  const resolvedHref = href ?? postDetailHref(post);
  const openPost = () => {
    navigate({ to: resolvedHref });
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  };

  const reactionModel = useReactionBarModel({
    size: reactionSize,
    variant: "pill",
    post,
    policy: reactionPolicy,
    summaryContextUnitId,
    reactionContextUnitId,
    actions: reactionActions,
    overflow: reactionOverflow,
    actionPolicy: reactionActionPolicy,
    onReplyInvoke: onReplyInvoke ?? openPost,
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

  const renderReactionFooter = (footerClassName?: string) => (
    <div
      className={cn("flex items-center justify-between gap-2", footerClassName)}
    >
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
  );

  return (
    <Card
      surface="plain"
      interactive
      role="link"
      tabIndex={0}
      aria-label={typeof resolvedTitle === "string" ? resolvedTitle : undefined}
      onClick={openPost}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform]",
        "hover:-translate-y-0.5",
        className,
      )}
    >
      <article
        className={cn(
          "flex min-w-0 items-stretch gap-4 p-3",
          mediaMode === "forward" && "flex-col gap-3",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <PostAuthorHeader post={post} />
            </div>
            <StreamReviewRating post={post} />
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
            // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents parent stream card navigation when the nested route link is used.
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

          {mediaMode !== "forward"
            ? renderReactionFooter("mt-auto pt-1")
            : null}
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

        {mediaMode === "forward" ? renderReactionFooter("pt-1") : null}
      </article>
    </Card>
  );
}

/**
 * Derive the detail-page href for a post based on its kind.
 * 根据帖子类型推导详情页路径。
 */
function postDetailHref(post: PostDTO): string {
  switch (post.kind) {
    case PostKind.REVIEW:
      return `/review/${post.unitId}`;
    case PostKind.REMARK:
      return `/remark/${post.unitId}`;
    default:
      return `/post/${post.unitId}`;
  }
}

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

function StreamReviewRating({ post }: { post: PostDTO }) {
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
