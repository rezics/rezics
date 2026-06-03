import { useEditorEntry } from "@rezics/api/hooks";
import {
  extractPollUnitIdsFromContentDoc,
  type PostDTO,
  PostKind,
  type UnitRealmModerationState,
  type VariantContextSummary,
} from "@rezics/contract";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Pencil, Shield } from "lucide-react";
import type React from "react";
import {
  ReactionActionRow,
  ReactionOverflowMenu,
  useReactionBarModel,
} from "@/engagement";
import { PollEmbed } from "@/poll";
import { cn } from "@/shared/utils/css-util";
import { VariantContextLink } from "@/unit";
import {
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "../../models/postPolicy";
import { PostAuthorAvatar, PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";

interface PostCardProps {
  post: PostDTO;
  onOpen?: () => void;
  variantContext?: VariantContextSummary | null;
  href?: string;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
  manageMode?: boolean;
  manageRealmId?: string;
  realmModerationState?: UnitRealmModerationState;
  realmModerationAt?: string | Date | null;
  realmVisibilityState?: "hidden" | "tombstoned" | null;
  overflowContent?: React.ReactNode;
  moderationMenuContent?: React.ReactNode;
}

type StatusBadge = {
  key: string;
  label: string;
  tone: "success" | "warning" | "error";
};

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

function ModerationStatus({
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

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onOpen,
  variantContext,
  href,
  summaryScopeKey,
  reactionScopeKey,
  manageMode = false,
  realmModerationState,
  realmModerationAt,
  realmVisibilityState,
  overflowContent,
  moderationMenuContent,
}) => {
  const navigate = useNavigate();
  const rootPostUnitId = post.unitId;
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);
  const editorEntry = useEditorEntry({
    surface: post.kind === PostKind.WIKI ? "wikiPost" : "post",
    ownerUnit: { user: post.author },
    capabilities: post.kind === PostKind.WIKI ? ["content", "tag"] : undefined,
  });

  const handleReplyInvoke = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    if (href) {
      navigate({
        to: href,
        search: { focus: "reply" },
      });
      return;
    }
    navigate({
      to: "/post/$rootPostUnitId",
      params: { rootPostUnitId },
      search: { focus: "reply" },
    });
  };

  const statusBadges = [
    realmModerationState
      ? {
          key: "relation-moderation",
          label:
            realmModerationState === "pending_review"
              ? "Pending review"
              : realmModerationState === "approved"
                ? "Approved"
                : realmModerationState === "rejected"
                  ? "Rejected"
                  : "Removed",
          tone:
            realmModerationState === "approved"
              ? "success"
              : realmModerationState === "pending_review"
                ? "warning"
                : "error",
        }
      : null,
    realmVisibilityState
      ? {
          key: "visibility",
          label: realmVisibilityState === "hidden" ? "Hidden" : "Tombstoned",
          tone: realmVisibilityState === "tombstoned" ? "error" : "warning",
        }
      : null,
  ].filter(Boolean) as StatusBadge[];

  const handleCardClick = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    if (href) {
      navigate({ to: href });
      return;
    }
    navigate({
      to: "/post/$rootPostUnitId",
      params: { rootPostUnitId },
    });
  };

  const unitOverflowContent = editorEntry.canEnter ? (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Unit</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            navigate({
              to: "/post/$rootPostUnitId/edit",
              params: { rootPostUnitId },
            });
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  ) : null;
  const composedOverflowContent =
    unitOverflowContent || overflowContent ? (
      <>
        {unitOverflowContent}
        {overflowContent}
      </>
    ) : undefined;
  const reactionModel = useReactionBarModel({
    size: "md",
    variant: "pill",
    post,
    policy: postPolicy,
    summaryScopeKey,
    reactionScopeKey,
    actions: postCardActions,
    overflow: postCardOverflow,
    onReplyInvoke: handleReplyInvoke,
    overflowContent: composedOverflowContent,
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole card click is pointer-only; nested actions and links provide keyboard access.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can open via nested controls or route links.
    <div
      className="relative py-3 border-b border-border-whisper cursor-pointer"
      onClick={handleCardClick}
    >
      <ReactionOverflowMenu
        model={reactionModel}
        className="absolute right-0 top-3 z-10 sm:hidden"
      />
      <div className="flex flex-col gap-2">
        <div className="pr-10 sm:pr-0">
          <PostAuthorHeader post={post} />
        </div>
        {post.title ? (
          <h3 className="m-0 line-clamp-2 text-base font-medium leading-ui text-text-primary">
            {post.title}
          </h3>
        ) : null}
        <PostBodyMarkdown
          content={post.content}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        {resolvedVariantContext && (
          // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent card click when the nested route link is used.
          <div
            className="w-fit max-w-full"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={() => undefined}
          >
            <VariantContextLink context={resolvedVariantContext} />
          </div>
        )}
        {pollUnitIds.map((pollUnitId) => (
          <PollEmbed
            key={pollUnitId}
            pollUnitId={pollUnitId}
            realmUnitId={post.realmUnitId}
          />
        ))}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <ReactionActionRow model={reactionModel} />
            <ReactionOverflowMenu
              model={reactionModel}
              className="hidden sm:block"
            />
          </div>
          {manageMode && (statusBadges.length > 0 || moderationMenuContent) ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: this wrapper prevents nested moderation controls from triggering the parent card link.
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={() => undefined}
            >
              <ModerationStatus
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
      </div>
    </div>
  );
};
