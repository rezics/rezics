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
import { RemovedContentPlaceholder } from "@/components/RemovedContentPlaceholder";
import { ReactionBar } from "@/engagement";
import { PollEmbed } from "@/poll";
import {
  postPolicy,
  postReplyRowActions,
  postReplyRowOverflow,
} from "../../models/postPolicy";
import { CommentPromotionBadge } from "../parts/CommentPromotionBadge";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";

interface PostReplyProps {
  post: PostDTO | CommentDTO;
  onReply?: () => void;
  overflowContent?: React.ReactNode;
  replyComposerSlot?: React.ReactNode;
  showAvatar?: boolean;
  summaryScopeKey?: string | null;
  reactionScopeKey?: string | null;
}

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  onReply,
  overflowContent,
  replyComposerSlot,
  showAvatar = true,
  summaryScopeKey,
  reactionScopeKey,
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
        {post.pinKind ? <CommentPromotionBadge pinKind={post.pinKind} /> : null}
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
          policy={postPolicy}
          summaryScopeKey={summaryScopeKey}
          reactionScopeKey={reactionScopeKey}
          actions={postReplyRowActions}
          overflow={postReplyRowOverflow}
          onReplyInvoke={onReply}
          overflowContent={overflowContent}
        />
        {replyComposerSlot}
      </div>
    </div>
  );
};
