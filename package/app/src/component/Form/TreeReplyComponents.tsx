// 暂时就先这样不处理，后面树化，或者使用VirtualList

import {Add, Remove} from '@mui/icons-material';
import {Avatar, Box, Collapse, IconButton, Typography} from '@mui/material';
import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
//  ;

import {useDialogStore} from '@/global/dialogStore.ts';
import {ReactionBarContainer} from '../Common/ReactionBar.tsx';
import {ReplyDrawerContainer} from './ReplyDrawer.tsx';

import {commentQueries} from '@/api/comment/comment.queries.ts';
import type {CommentTreeNode} from '@package/contract';
import {useCreateCommentMutation} from '@/api/comment/comment.mutations';

// This is a temporary type definition based on the GraphQL schema.
// Local UI type adapted from CommentTreeNode
type UiAuthor = {
  name: string;
  avatar?: string | null;
};

type UiComment = {
  id: string;
  content?: string | null;
  created_at?: string;
  author?: UiAuthor;
  replies?: UiComment[];
};
interface CommentNodeProps {
  comment: UiComment;
  level?: number;
  openDrawer: (id: string) => void;
}

const CommentNode: React.FC<CommentNodeProps> = ({
  comment,
  level = 0,
  openDrawer,
}) => {
  // Expand first two levels by default
  const [isExpanded, setIsExpanded] = useState(level < 2);

  const handleToggleExpand = () => {
    if (comment.replies && comment.replies.length > 0) {
      setIsExpanded(!isExpanded);
    }
    // TODO: Implement asynchronous loading of comments if they are not already fetched.
    // This would require a new GraphQL query like getReplies(commentId: ID!).
  };

  const handleReply = () => {
    console.log('Replying to comment:', comment.id);
    openDrawer(comment.id);
    // This is where you would trigger a reply dialog or an inline reply form.
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
          src={comment.author?.avatar ?? undefined}
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
              {comment.author?.name ?? 'Unknown'}
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
          <Box className="w-full flex justify-end">
            <Box
              sx={{
                width: {
                  xs: '75%',
                  sm: '50%',
                  md: '33%',
                  lg: '30%',
                  xl: '30%',
                },
              }}
            >
              <ReactionBarContainer
                onReply={handleReply}
                className="mt-2"
                size="small"
                fontSize="1.3rem"
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

export const TreeReplyComponents: React.FC<ReplyComponentsProps> = ({
  unitId,
}) => {
  // Fetch a flat slice of the comment tree for the unit
  const {data, isLoading, error} = useQuery(
    commentQueries.unitCommentTree(unitId, {
      // Fetch up to depth 3 for an initial view; adjust as needed
      maxDepth: 3,
      order: 'asc',
      start: 0,
      limit: 200,
    }),
  );

  // currentReplyId
  const setDialogVisible = useDialogStore(state => state.setDialogVisible);
  const [currentReplyId, setCurrentReplyId] = useState<string | null>(null);
  const [topLevelComments, setTopLevelComments] = useState<UiComment[]>([]);

  const buildTree = useMemo(() => {
    return (items: CommentTreeNode[] | undefined): UiComment[] => {
      if (!items || items.length === 0) return [];

      // Map of id -> UiComment
      const map = new Map<string, UiComment>();
      // Group by parentId
      const childrenMap = new Map<string | null | undefined, UiComment[]>();

      for (const n of items) {
        const ui: UiComment = {
          id: n.id,
          content: n.content ?? null,
          created_at: n.createdAt
            ? typeof n.createdAt === 'string'
              ? n.createdAt
              : new Date(n.createdAt as any).toISOString()
            : undefined,
          author: n.user
            ? {name: n.user.name, avatar: n.user.avatar ?? undefined}
            : undefined,
          replies: [],
        };
        map.set(n.id, ui);
        const key = (n as any).parentCommentId ?? null;
        const list = childrenMap.get(key) ?? [];
        list.push(ui);
        childrenMap.set(key, list);
      }

      // Link children to parents
      for (const n of items) {
        const parentId = (n as any).parentCommentId ?? null;
        if (parentId && map.has(parentId)) {
          const parent = map.get(parentId)!;
          const childList = childrenMap.get(parentId) ?? [];
          // Ensure parent's replies uses grouped list
          parent.replies = childList;
        }
      }

      // Roots are those with no parent or missing parent in this slice
      const roots: UiComment[] = [];
      const rootCandidates =
        childrenMap.get(null) ?? childrenMap.get(undefined) ?? [];
      for (const r of rootCandidates) {
        roots.push(r);
      }

      // Some nodes may reference a parent not included in the slice; treat them as roots
      if (roots.length === 0) {
        // Fallback: choose items with missing parent
        for (const n of items) {
          const parentId = (n as any).parentCommentId ?? null;
          if (!parentId || !map.has(parentId)) {
            const ui = map.get(n.id)!;
            if (!roots.includes(ui)) roots.push(ui);
          }
        }
      }

      return roots;
    };
  }, []);

  useEffect(() => {
    try {
      const items = data?.items;
      const tree = buildTree(items as any);
      setTopLevelComments(tree);
    } catch (_error) {
      console.error('Error building comment tree');
    }
  }, [data, buildTree]);

  const openDrawer = (id: string) => {
    setCurrentReplyId(id);
    setDialogVisible(`reply-${id}`, true);
  };

  const createCommentMutation = useCreateCommentMutation();

  const handleSubmit = (content: string) => {
    createCommentMutation.mutate({
      rootPostId: unitId,
      parentCommentId: currentReplyId || '',
      content,
    });
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
          dialogId={`reply-${currentReplyId}`}
          onSubmit={(content: string) => handleSubmit(content)}
        />
      )}
    </>
  );
};

export default TreeReplyComponents;
