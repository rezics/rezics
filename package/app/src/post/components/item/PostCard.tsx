import {
  useHideRealmContentMutation,
  useRemoveRealmFeedRootMutation,
} from "@rezics/api/governance/governance.mutations";
import { useDeletePostMutation } from "@rezics/api/post/post.mutations";
import { useAppendRealmPinboardMutation } from "@rezics/api/realm/realm";
import {
  extractPollUnitIdsFromContentDoc,
  type PostDTO,
  type UnitRealmModerationState,
  type VariantContextSummary,
} from "@rezics/contract";
import {
  Badge,
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
import { Pin, Shield } from "lucide-react";
import type React from "react";
import { toast } from "sonner";
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
  realmVisibilityState?: "hidden" | "tombstoned" | null;
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

function ModerationStatusCompact({
  post,
  statuses,
}: {
  post: PostDTO;
  statuses: StatusBadge[];
}) {
  if (statuses.length === 0) return null;
  const [primary, secondary] = statuses;

  return (
    <div
      className="relative shrink-0"
      title={statuses.map((status) => status.label).join(", ")}
    >
      <PostAuthorAvatar post={post} size="compact" className="size-8" />
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
  manageRealmId,
  realmModerationState,
  realmVisibilityState,
}) => {
  const navigate = useNavigate();
  const deletePost = useDeletePostMutation({
    onSuccess: () => toast.success("Post deleted."),
    onError: (error) => toast.error(error.message),
  });
  const pinPost = useAppendRealmPinboardMutation({
    onSuccess: () => toast.success("Post pinned."),
    onError: (error) => toast.error(error.message),
  });
  const removeFromFeed = useRemoveRealmFeedRootMutation({
    onSuccess: () => toast.success("Post removed from realm feed."),
    onError: (error) => toast.error(error.message),
  });
  const hideInRealm = useHideRealmContentMutation({
    onSuccess: () => toast.success("Post hidden in this realm."),
    onError: (error) => toast.error(error.message),
  });
  const rootPostUnitId = post.unitId;
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);

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
          label:
            realmVisibilityState === "hidden"
              ? "Hidden"
              : "Tombstoned",
          tone: realmVisibilityState === "tombstoned" ? "error" : "warning",
        }
      : null,
  ].filter(Boolean) as StatusBadge[];
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
  });

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

  const runAdminAction = (
    event: Event | React.MouseEvent,
    message: string,
    action: () => void,
  ) => {
    if ("stopPropagation" in event) event.stopPropagation();
    if (!window.confirm(message)) return;
    action();
  };

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
          {manageMode && (statusBadges.length > 0 || manageRealmId) ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: this wrapper prevents nested moderation controls from triggering the parent card link.
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={() => undefined}
            >
              {statusBadges.length > 0 ? (
                <>
                  <div className="hidden flex-wrap gap-1 sm:flex">
                    {statusBadges.map((badge) => (
                      <Badge key={badge.key} variant="outline">
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                  <div className="sm:hidden">
                    <ModerationStatusCompact
                      post={post}
                      statuses={statusBadges}
                    />
                  </div>
                </>
              ) : null}
              {manageRealmId ? (
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
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Realm moderation</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={removeFromFeed.isPending}
                        onSelect={(event) =>
                          runAdminAction(
                            event as unknown as Event,
                            "Remove this post from the realm feed?",
                            () =>
                              removeFromFeed.mutate({
                                realmUnitId: manageRealmId,
                                targetUnitId: post.unitId,
                              }),
                          )
                        }
                      >
                        <Shield className="h-4 w-4" aria-hidden />
                        Remove from feed
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Realm moderation</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={hideInRealm.isPending}
                        onSelect={(event) =>
                          runAdminAction(
                            event as unknown as Event,
                            "Hide this post in this realm?",
                            () =>
                              hideInRealm.mutate({
                                realmUnitId: manageRealmId,
                                targetUnitId: post.unitId,
                                input: { reason: "moderator_action" },
                              }),
                          )
                        }
                      >
                        <Shield className="h-4 w-4" aria-hidden />
                        Hide in realm
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletePost.isPending}
                        onSelect={(event) =>
                          runAdminAction(
                            event as unknown as Event,
                            "Delete this post?",
                            () => deletePost.mutate(post.unitId),
                          )
                        }
                      >
                        <Shield className="h-4 w-4" aria-hidden />
                        Delete post
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Organization</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={pinPost.isPending}
                        onSelect={(event) =>
                          runAdminAction(
                            event as unknown as Event,
                            "Pin this post?",
                            () =>
                              pinPost.mutate({
                                realmUnitId: manageRealmId,
                                unitId: post.unitId,
                              }),
                          )
                        }
                      >
                        <Pin className="h-4 w-4" aria-hidden />
                        Pin
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
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
