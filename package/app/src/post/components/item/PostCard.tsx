import { useEditorEntry } from "@rezics/api/hooks";
import {
  extractPollUnitIdsFromContentDoc,
  type ModerationActionDTO,
  type ModerationStatus,
  type PostDTO,
  PostKind,
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
import {
  ModerationBadge,
  moderationControlStateClass,
} from "../parts/ModerationBadge";
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
  realmModerationStatus?: ModerationStatus;
  realmModerationAt?: string | Date | null;
  moderationLatestAction?: ModerationActionDTO | null;
  overflowContent?: React.ReactNode;
  moderationMenuContent?: React.ReactNode;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onOpen,
  variantContext,
  href,
  summaryScopeKey,
  reactionScopeKey,
  manageMode = false,
  realmModerationStatus,
  realmModerationAt,
  moderationLatestAction,
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
                        aria-label="Realm moderation actions"
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
      </div>
    </div>
  );
};
