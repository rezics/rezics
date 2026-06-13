import {
  extractPollUnitIdsFromContentDoc,
  type PostDTO,
  type VariantContextSummary,
} from "@rezics/contract";
import type React from "react";
import {
  ReactionActionRow,
  ReactionOverflowMenu,
  useReactionBarModel,
} from "@/engagement";
import { PollEmbed } from "@/poll";
import { VariantContextLink } from "@/unit";
import {
  postDetailActions,
  postDetailOverflow,
  postPolicy,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";

export interface PostDetailProps {
  post: PostDTO;
  variantContext?: VariantContextSummary | null;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
  onReplyInvoke?: () => void;
  overflowContent?: React.ReactNode;
}

/**
 * Full thread rendering stays separate from preview cards because cards own
 * click-through navigation and truncation. Detail pages render complete content.
 */
export function PostDetail({
  post,
  variantContext,
  summaryContextUnitId,
  reactionContextUnitId,
  onReplyInvoke,
  overflowContent,
}: PostDetailProps) {
  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);
  const resolvedVariantContext = variantContext ?? post.variantContext;
  const reactionModel = useReactionBarModel({
    size: "md",
    variant: "pill",
    post,
    policy: postPolicy,
    summaryContextUnitId,
    reactionContextUnitId,
    actions: postDetailActions,
    overflow: postDetailOverflow,
    onReplyInvoke,
    overflowContent,
  });

  return (
    <article className="relative flex min-w-0 flex-col gap-4 py-3">
      <ReactionOverflowMenu
        model={reactionModel}
        className="absolute right-0 top-3 z-10 sm:hidden"
      />
      <div className="pr-10 sm:pr-0">
        <PostAuthorHeader post={post} />
      </div>
      {post.title ? (
        <h1 className="m-0 text-2xl font-semibold leading-ui text-text-primary">
          {post.title}
        </h1>
      ) : null}
      <PostBodyMarkdown
        content={post.content}
        clamp={false}
        className="text-base leading-body text-text-primary"
      />
      {resolvedVariantContext ? (
        <div className="w-fit max-w-full">
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
      <div className="flex min-w-0 items-center gap-1.5 border-t border-border-whisper pt-3">
        <ReactionActionRow model={reactionModel} />
        <ReactionOverflowMenu
          model={reactionModel}
          className="hidden sm:block"
        />
      </div>
    </article>
  );
}
