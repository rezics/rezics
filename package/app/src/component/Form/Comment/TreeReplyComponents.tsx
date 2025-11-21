// 暂时就先这样不处理，后面树化，或者使用VirtualList

import {Add, Remove} from '@mui/icons-material';
import {Avatar, Box, Collapse, IconButton, Typography} from '@mui/material';
import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
//  ;

import {useDialogStore} from '@/global/dialogStore.ts';
import {
  ReactionAdminBar,
  ReactionBar,
} from '../../Common/Reaction/ReactionBar.tsx';
import {ReplyDrawerContainer} from './ReplyDrawer.tsx';

import {commentQueries} from '@/api/comment/comment.queries.ts';
import type {CommentTreeNode} from '@package/contract';
import {
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from '@/api/comment/comment.mutations';

import {useUserStore} from '@/global/userStore';
import {buildTree} from '../treeReplyUtil.ts';

import {useAlertStore} from '@/global/windowAlertStore';
// This is a temporary type definition based on the GraphQL schema.
// Local UI type adapted from CommentTreeNode
type UiUser = {
  unitId: string;
  name: string;
  avatar?: string | null;
  [key: string]: any;
};

export type UiComment = {
  id: string;
  content?: string | null;
  created_at?: string;
  user?: UiUser;
  replies?: UiComment[];
};
interface CommentNodeProps {
  comment: UiComment;
  level?: number;
  openDrawer: (id: string, content?: string) => void;
}

function havePermission(comment: any, user: any) {
  return (
    comment.user?.unitId === user?.unitId ||
    user?.permission?.role?.includes('ADMIN')
  );
}

const CommentNode: React.FC<CommentNodeProps> = ({
  comment,
  level = 0,
  openDrawer,
}) => {
  // Expand first two levels by default
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const user = useUserStore(state => state.user);
  const handleToggleExpand = () => {
    if (comment.replies && comment.replies.length > 0) {
      setIsExpanded(!isExpanded);
    }
    // TODO: Implement asynchronous loading of comments if they are not already fetched.
    // This would require a new GraphQL query like getReplies(commentId: ID!).
  };

  const showAlert = useAlertStore(state => state.show);

  const handleReply = () => {
    console.log('Replying to comment:', comment.id);
    openDrawer(comment.id);
    // This is where you would trigger a reply dialog or an inline reply form.
  };

  const deleteCommentMutation = useDeleteCommentMutation({
    onSuccess: () => {
      showAlert('Comment deleted successfully');
    },
    onError: () => {
      showAlert('Failed to delete comment');
    },
  });

  const handleDelete = () => {
    deleteCommentMutation.mutate(comment.id);
  };

  const setDialogContent = useDialogStore(state => state.setDialogContent);

  const handleUpdate = () => {
    console.log('handleUpdate', comment.id);
    const key = `update_${comment.id}`;
    setDialogContent(key, comment.content ?? '');
    openDrawer(key);
  };

  return (
    <Box
      mt={2}
      pl={level > 0 ? 4 : 0}
      sx={{
        borderLeft: level > 0 ? `2px solid #eee` : 'none',
        marginLeft: level > 0 ? '16px' : '0',
        paddingLeft: level > 0 ? '16px' : '0',
      }}
    >
      <Box display="flex" gap={2} alignItems="flex-start">
        <Avatar
          src={comment.user?.avatar ?? undefined}
          sx={{width: 32, height: 32}}
        />
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="subtitle2"
              component="span"
              color="text.primary"
              fontWeight="bold"
            >
              {comment.user?.name ?? 'Unknown'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {comment.created_at
                ? new Date(comment.created_at).toLocaleString()
                : ''}
            </Typography>
          </Box>
          <Typography variant="body2" mt={1}>
            {comment.content}
          </Typography>
          <Box className="w-full flex justify-end mt-2">
            <ReactionAdminBar
              className={`${havePermission(comment, user) ? '' : 'hidden'}`}
              size="small"
              fontSize="1.3rem"
              onEdit={handleUpdate}
              onDelete={handleDelete}
            />
            <Box
              sx={{
                width: {
                  xs: '30%',
                  sm: '30%',
                  md: '23%',
                  lg: '20%',
                  xl: '15%',
                },
              }}
            >
              <ReactionBar
                onReply={handleReply}
                size="small"
                fontSize="1.3rem"
                hideLike={true}
                hideDislike={true}
              />
            </Box>
          </Box>
        </Box>
        {comment.replies && comment.replies.length > 0 && (
          <IconButton onClick={handleToggleExpand} size="small">
            {isExpanded ? <Remove /> : <Add />}
          </IconButton>
        )}
      </Box>

      {comment.replies && comment.replies.length > 0 && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          {comment.replies.map(reply => (
            <CommentNode
              key={reply.id}
              comment={reply}
              level={level + 1}
              openDrawer={openDrawer}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

interface ReplyComponentsProps {
  unitId: string;
}

export function TreeReplyComponents({unitId}: ReplyComponentsProps) {
  // Fetch a flat slice of the comment tree for the unit
  const showAlert = useAlertStore(state => state.show);
  const {data, isLoading, error} = useQuery(
    commentQueries.unitCommentTree(unitId, {
      // Fetch up to depth 3 for an initial view; adjust as needed
      maxDepth: 100,
      order: 'asc',
      start: 0,
      limit: 200,
    }),
  );

  // currentReplyId
  const setDialogVisible = useDialogStore(state => state.setDialogVisible);
  const [currentReplyId, setCurrentReplyId] = useState<string | null>(null);
  const [topLevelComments, setTopLevelComments] = useState<UiComment[]>([]);

  useEffect(() => {
    try {
      const items = data?.items;
      const tree = buildTree(items as any);
      setTopLevelComments(tree);
    } catch (_error) {
      console.error('Error building comment tree');
    }
  }, [data]);

  const openDrawer = (id: string) => {
    setCurrentReplyId(id);
    setDialogVisible(id, true);
  };

  const createCommentMutation = useCreateCommentMutation({
    onSuccess: () => {
      showAlert('Comment created successfully');
    },
    onError: () => {
      showAlert('Failed to create comment');
    },
  });

  const updateCommentMutation = useUpdateCommentMutation({
    onSuccess: () => {
      showAlert('Comment updated successfully');
    },
    onError: () => {
      showAlert('Failed to update comment');
    },
  });

  const handleSubmit = (content: string) => {
    if (currentReplyId && currentReplyId.startsWith('update_')) {
      updateCommentMutation.mutate({
        unitId: currentReplyId.replace('update_', ''),
        input: {
          content,
        },
      });
    } else {
      createCommentMutation.mutate({
        rootPostId: unitId,
        parentCommentId: currentReplyId || '',
        content,
      });
    }
  };
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Oh no... {error.message}</p>;

  return (
    <>
      <Box p={2}>
        {topLevelComments.length > 0 ? (
          topLevelComments.map((comment: UiComment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              openDrawer={openDrawer}
            />
          ))
        ) : (
          <p>No comments</p>
        )}
      </Box>
      {/* 渲染 */}
      {currentReplyId && (
        <ReplyDrawerContainer
          dialogId={currentReplyId}
          onSubmit={(content: string) => handleSubmit(content)}
        />
      )}
    </>
  );
}

export default TreeReplyComponents;
