import React, {useState} from 'react';
import {ReplyDrawerContainer} from './ReplyDrawer';
import {useCreateCommentMutation} from '@package/api/comment/comment.mutations';
import {useAlertStore} from '@app/state/windowAlertStore';
import {useDialogStore} from '@/global/dialogStore';

export function SingleCommentElementWrapper({
  replyUnitId,
  children,
  className,
}: {
  replyUnitId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const setDialogVisible = useDialogStore(state => state.setDialogVisible);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const showAlert = useAlertStore(state => state.show);
  const createCommentMutation = useCreateCommentMutation({
    onSuccess: () => {
      showAlert('Comment created successfully');
    },
    onError: () => {
      showAlert('Failed to create comment');
    },
  });

  const handleReply = () => {
    setIsReplyModalOpen(true);
    setDialogVisible(replyUnitId, true);
  };

  const handleSubmit = (content: string) => {
    createCommentMutation.mutate({
      rootPostId: replyUnitId || '',
      content,
    });
  };
  return (
    <div className={className}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div role="button" tabIndex={0} onClick={handleReply}>
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
