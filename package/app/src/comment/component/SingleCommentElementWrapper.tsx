import { useAlertStore } from "@app/state/windowAlertStore";
import { useCreateCommentMutation } from "@rezics/api/comment/comment.mutations";
import type React from "react";
import { useState } from "react";
import { useDialogStore } from "../state/dialogStore";
import { ReplyDrawerContainer } from "./ReplyDrawer";

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
  const createCommentMutation = useCreateCommentMutation({
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
    createCommentMutation.mutate({
      rootPostId: replyUnitId || "",
      content,
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
