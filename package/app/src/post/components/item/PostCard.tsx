import {
  useHideRealmContentMutation,
  useRemoveRealmFeedRootMutation,
} from "@rezics/api/governance/governance.mutations";
import { useDeletePostMutation } from "@rezics/api/post/post.mutations";
import { useAppendRealmPinboardMutation } from "@rezics/api/realm/realm";
import {
  extractPollUnitIdsFromContentDoc,
  type PostDTO,
  type VariantContextSummary,
} from "@rezics/contract";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Pin, Shield } from "lucide-react";
import type React from "react";
import { toast } from "sonner";
import { ReactionBar } from "@/engagement";
import { PollEmbed } from "@/poll";
import { VariantContextLink } from "@/unit";
import {
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole card click is pointer-only; nested actions and links provide keyboard access.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can open via nested controls or route links.
    <div
      className="py-3 border-b border-border-whisper cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2">
        <PostAuthorHeader post={post} />
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
        <ReactionBar
          size="md"
          variant="pill"
          post={post}
          policy={postPolicy}
          summaryScopeKey={summaryScopeKey}
          reactionScopeKey={reactionScopeKey}
          actions={postCardActions}
          overflow={postCardOverflow}
          onReplyInvoke={handleReplyInvoke}
        />
        {manageMode && manageRealmId ? (
          <div
            className="flex justify-end pt-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={() => undefined}
          >
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
                <DropdownMenuLabel>Feed publication</DropdownMenuLabel>
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
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  );
};
