import {
  type CommentDTO,
  extractPollUnitIdsFromContentDoc,
  type PostDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Shield } from "lucide-react";
import type React from "react";
import { RemovedContentPlaceholder } from "@/components";
import { ReactionBar } from "@/engagement";
import { PollEmbed } from "@/poll";
import { PostAuthorHeader, PostBodyMarkdown } from "@/post";
import {
  commentPolicy,
  commentRowActions,
  commentRowOverflow,
} from "../../models/commentPolicy";
import { CommentPromotionBadge } from "../parts/CommentPromotionBadge";

interface CommentReplyProps {
  post: PostDTO | CommentDTO;
  onReply?: () => void;
  overflowContent?: React.ReactNode;
  replyComposerSlot?: React.ReactNode;
  /**
   * Context (realm/direct) badge supplied by mixed "All" thread views;
   * single-context views leave it unset.
   * 混合“全部”线程视图传入的语境（realm/直接）徽章；单一语境视图不设置。
   */
  contextBadge?: React.ReactNode;
  showAvatar?: boolean;
  summaryContextUnitId?: string | null;
  reactionContextUnitId?: string | null;
}

export const CommentReply: React.FC<CommentReplyProps> = ({
  post,
  onReply,
  overflowContent,
  replyComposerSlot,
  contextBadge,
  showAvatar = true,
  summaryContextUnitId,
  reactionContextUnitId,
}) => {
  const { t } = useTranslation(["community"]);
  const contentIndentClass = showAvatar ? "pl-10" : "";
  const isRedacted = "isRedacted" in post && post.isRedacted;
  const redactionKind = isRedacted ? post.redactionKind : null;
  if (isRedacted) {
    return (
      <div className="flex min-w-0 flex-col gap-1 py-1">
        <div className={contentIndentClass}>
          <div className="flex min-w-0 items-center gap-2">
            <RemovedContentPlaceholder
              redactionKind={redactionKind}
              className="flex-1"
            />
            {overflowContent ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  nativeButton
                  render={(props) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t("community:comment_moderation_actions")}
                      className="h-8 w-8 shrink-0 p-0 text-text-secondary"
                      {...props}
                    >
                      <Shield className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                />
                <DropdownMenuContent align="end">
                  {overflowContent}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const pollUnitIds = extractPollUnitIdsFromContentDoc(post.content);

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1">
      <PostAuthorHeader post={post} size="compact" showAvatar={showAvatar} />
      <div className={`flex min-w-0 flex-col gap-1 ${contentIndentClass}`}>
        {post.pinKind || contextBadge ? (
          <div className="flex flex-wrap items-center gap-2">
            {post.pinKind ? (
              <CommentPromotionBadge pinKind={post.pinKind} />
            ) : null}
            {contextBadge}
          </div>
        ) : null}
        <PostBodyMarkdown
          content={post.content}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        {pollUnitIds.map((pollUnitId) => (
          <PollEmbed
            key={pollUnitId}
            pollUnitId={pollUnitId}
            realmUnitId={post.realmUnitId}
          />
        ))}
        <ReactionBar
          size="sm"
          post={post}
          policy={commentPolicy}
          summaryContextUnitId={summaryContextUnitId}
          reactionContextUnitId={reactionContextUnitId}
          actions={commentRowActions}
          overflow={commentRowOverflow}
          onReplyInvoke={onReply}
          overflowContent={overflowContent}
        />
        {replyComposerSlot}
      </div>
    </div>
  );
};
