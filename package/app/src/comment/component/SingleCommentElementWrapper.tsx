import { useAlertStore } from "@app/state/windowAlertStore";
import { useCreatePostMutation } from "@rezics/api/post/post";
import type React from "react";
import { useState } from "react";
import { useDialogStore } from "../state/dialogStore";
import { ReplyDrawerContainer } from "./ReplyDrawer";

/**
 * SingleCommentElementWrapper - now uses Post API instead of Comment API.
 * Creates a post reply when submitting a comment.
 */
export function SingleCommentElementWrapper({
  replyUnitId,
  children,
  className,
}: {
  replyUnitId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const setDialogVisible = useDialogStore((state) => state.setDialogVisible);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const showAlert = useAlertStore((state) => state.show);
  const createPostMutation = useCreatePostMutation({
    onSuccess: () => {
      showAlert("Comment created successfully");
    },
    onError: () => {
      showAlert("Failed to create comment");
    },
  });

  const handleReply = () => {
    setIsReplyModalOpen(true);
    setDialogVisible(replyUnitId, true);
  };

  const handleSubmit = (content: string) => {
    createPostMutation.mutate({
      targetUnitId: replyUnitId,
      kindKey: 'comment',
      body: content,
    });
  };
  return (
    <div className={className}>
      {/* biome-ignore lint/a11y/useSemanticElements: interactive wrapper for reply action */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleReply}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleReply();
          }
        }}
      >
        {children}
      </div>
      {isReplyModalOpen && (
        <ReplyDrawerContainer
          dialogId={replyUnitId}
          onSubmit={(content: string) => handleSubmit(content)}
        />
      )}
    </div>
  );
}
