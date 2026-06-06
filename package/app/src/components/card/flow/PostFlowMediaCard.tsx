import { mainMarkdownSource, type PostDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Card, CardMedia } from "@rezics/ui/shadcn";
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
import type { PostFlowMedia } from "./PostFlowCard";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface PostFlowMediaCardProps {
  post: PostDTO;
  media?: PostFlowMedia;
  mediaSlot?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
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

export function PostFlowMediaCard({
  bodyLines = 3,
  className,
  media,
  mediaSlot,
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
}: PostFlowMediaCardProps) {
  const markdown = mainMarkdownSource(post.content) ?? "";

  return (
    <Card
      surface="plain"
      interactive={Boolean(onOpen)}
      className={cn("w-full gap-0 py-0", className)}
      onClick={onOpen}
    >
      <article className="flex min-w-0 flex-col gap-3 p-3">
        <PostAuthorHeader post={post} />

        {title ? (
          <h3
            className="text-base font-medium leading-ui text-text-primary"
            style={clampStyle(titleLines)}
          >
            {title}
          </h3>
        ) : null}

        <CardMedia className="aspect-[16/9] rounded-sm bg-surface-subtle">
          {mediaSlot ??
            (media?.src ? (
              <img
                src={media.src}
                alt={media.alt ?? ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null)}
        </CardMedia>

        <div
          className="text-sm leading-ui text-text-secondary"
          style={clampStyle(bodyLines)}
        >
          <MarkdownContent content={markdown} />
        </div>

        <ReactionBar
          size={reactionSize}
          variant="pill"
          post={post}
          policy={reactionPolicy}
          actions={reactionActions}
          overflow={reactionOverflow}
          actionPolicy={reactionActionPolicy}
          onReplyInvoke={onReplyInvoke}
        />
      </article>
    </Card>
  );
}
