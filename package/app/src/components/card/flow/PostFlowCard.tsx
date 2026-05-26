import { mainMarkdownSource, type PostDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Card } from "@rezics/ui/shadcn";
import type React from "react";
import { ReactionBar } from "@/engagement";
import type { Action, ActionPolicy, EngagementSize } from "@/engagement/types";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import {
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "@/post/models/postPolicy";
import { cn } from "@/shared/utils/css-util";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface PostFlowMedia {
  alt?: string;
  src?: string | null;
}

export interface PostFlowCardProps {
  post: PostDTO;
  className?: string;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  media?: PostFlowMedia;
  mediaSlot?: React.ReactNode;
  metaSlot?: React.ReactNode;
  bodyLines?: number;
  titleLines?: number;
  onOpen?: () => void;
  onReplyInvoke?: () => void;
  reactionSize?: EngagementSize;
  reactionActions?: Action[];
  reactionOverflow?: Action[];
  reactionActionPolicy?: ActionPolicy;
  reactionPolicy?: React.ComponentProps<typeof ReactionBar>["policy"];
}

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

export function PostFlowCard({
  bodyLines = 4,
  className,
  eyebrow,
  media,
  mediaSlot,
  metaSlot,
  onOpen,
  onReplyInvoke,
  post,
  reactionActionPolicy,
  reactionActions = postCardActions,
  reactionOverflow = postCardOverflow,
  reactionPolicy = postPolicy,
  reactionSize = "md",
  title,
  titleLines = 2,
}: PostFlowCardProps) {
  const markdown = mainMarkdownSource(post.content) ?? "";
  const hasMedia = Boolean(mediaSlot || media?.src);

  return (
    <Card
      surface="plain"
      interactive={Boolean(onOpen)}
      className={cn("w-full gap-0 py-0", className)}
      onClick={onOpen}
    >
      <article className="flex min-w-0 gap-4 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <PostAuthorHeader post={post} />
            {eyebrow ? (
              <div className="shrink-0 text-xs leading-dense text-text-tertiary">
                {eyebrow}
              </div>
            ) : null}
          </div>

          {title ? (
            <h3
              className="text-base font-medium leading-ui text-text-primary"
              style={clampStyle(titleLines)}
            >
              {title}
            </h3>
          ) : null}

          <div
            className="text-sm leading-ui text-text-secondary"
            style={clampStyle(bodyLines)}
          >
            <MarkdownContent content={markdown} />
          </div>

          {metaSlot ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent flow card click when nested metadata content is used.
            // biome-ignore lint/a11y/useKeyWithClickEvents: the container itself is not an activation target.
            <div
              className="text-xs leading-dense text-text-tertiary"
              onClick={(event) => event.stopPropagation()}
            >
              {metaSlot}
            </div>
          ) : null}

          <ReactionBar
            size={reactionSize}
            variant="pill"
            post={post}
            policy={reactionPolicy}
            actions={reactionActions}
            overflow={reactionOverflow}
            actionPolicy={reactionActionPolicy}
            onReplyInvoke={onReplyInvoke}
            className="pt-1"
          />
        </div>

        {hasMedia ? (
          <div className="hidden h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-subtle sm:flex">
            {mediaSlot ??
              (media?.src ? (
                <img
                  src={media.src}
                  alt={media.alt ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null)}
          </div>
        ) : null}
      </article>
    </Card>
  );
}
