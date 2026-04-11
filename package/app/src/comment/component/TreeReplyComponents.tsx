import { Add, Remove } from "@mui/icons-material";
import { Avatar, Box, Collapse, IconButton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { useAlertStore } from "@app/state/windowAlertStore";
import {
  postQueries,
  useCreatePostMutation,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { reactionApi } from "@rezics/api/reaction/reaction";
import { useTranslation } from "react-i18next";
import {
  ReactionAdminBar,
  ReactionBar,
} from "@/engagement/component/ReactionBar.tsx";
import { useUserProfileStore } from "@/user/state";
import { useDialogStore } from "../state/dialogStore";
import { ReplyDrawerContainer } from "./ReplyDrawer.tsx";
import { buildTree } from "./tree-reply-util";

/**
 * TreeReplyComponents - now uses Post API instead of Comment API.
 * Comments are Posts with kindKey='comment' and threaded via parentPostUnitId.
 */

// Local UI type adapted from PostDTO for tree rendering
export type UiComment = {
  id: string;
  content?: string | null;
  created_at?: string;
  user?: {
    unitId: string;
    name: string;
    avatar?: string | null;
    [key: string]: any;
  };
  replies?: UiComment[];
};

interface CommentNodeProps {
  comment: UiComment;
  level?: number;
  openDrawer: (id: string, content?: string) => void;
  userReactionsByTarget?: Record<string, string[]>;
}

function havePermission(comment: any, user: any) {
  return (
    comment.user?.unitId === user?.unitId ||
    user?.permission?.role?.includes("ADMIN")
  );
}

const CommentNode: React.FC<CommentNodeProps> = ({
  comment,
  level = 0,
  openDrawer,
  userReactionsByTarget,
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const user = useUserProfileStore((state) => state.user);
  const handleToggleExpand = () => {
    if (comment.replies && comment.replies.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  const showAlert = useAlertStore((state) => state.show);

  const handleReply = () => {
    openDrawer(comment.id);
  };

  const deletePostMutation = useDeletePostMutation({
    onSuccess: () => {
      showAlert("Comment deleted successfully");
    },
    onError: () => {
      showAlert("Failed to delete comment");
    },
  });

  const handleDelete = () => {
    deletePostMutation.mutate(comment.id);
  };

  const setDialogContent = useDialogStore((state) => state.setDialogContent);

  const handleUpdate = () => {
    const key = `update_${comment.id}`;
    setDialogContent(key, comment.content ?? "");
    openDrawer(key);
  };

  const currentUserReactions =
    userReactionsByTarget?.[comment.id] ?? ([] as string[]);

  return (
    <Box
      mt={2}
      pl={level > 0 ? 4 : 0}
      sx={{
        borderLeft: level > 0 ? `2px solid #eee` : "none",
        marginLeft: level > 0 ? "16px" : "0",
        paddingLeft: level > 0 ? "16px" : "0",
      }}
    >
      <Box display="flex" gap={2} alignItems="flex-start">
        <Avatar
          src={comment.user?.avatar ?? undefined}
          sx={{ width: 32, height: 32 }}
        />
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="subtitle2"
              component="span"
              color="text.primary"
              fontWeight="bold"
            >
              {comment.user?.name ?? "Unknown"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {comment.created_at
                ? new Date(comment.created_at).toLocaleString()
                : ""}
            </Typography>
          </Box>
          <Typography variant="body2" mt={1}>
            {comment.content}
          </Typography>
          <Box className="w-full flex justify-end mt-2">
            <ReactionAdminBar
              className={`${havePermission(comment, user) ? "" : "hidden"}`}
              size="small"
              fontSize="1.3rem"
              onEdit={handleUpdate}
              onDelete={handleDelete}
            />
            <Box
              sx={{
                width: {
                  xs: "75%",
                  sm: "50%",
                  md: "35%",
                  lg: "30%",
                  xl: "25%",
                },
              }}
            >
              <ReactionBar
                onReply={handleReply}
                unitId={comment.id}
                size="small"
                fontSize="1.3rem"
                currentUserReactions={currentUserReactions}
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
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              level={level + 1}
              openDrawer={openDrawer}
              userReactionsByTarget={userReactionsByTarget}
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

export function TreeReplyComponents({ unitId }: ReplyComponentsProps) {
  const showAlert = useAlertStore((state) => state.show);
  const user = useUserProfileStore((state) => state.user);
  const { t } = useTranslation();

  function Core({ unitId }: { unitId: string }) {
    // Fetch comment-kind posts for this unit (threaded mode)
    const { data, isLoading, error } = useQuery({
      ...postQueries.byTarget(unitId, {
        kindKey: 'comment',
        mode: 'threaded',
        limit: 200,
      }),
      enabled: !!unitId,
    });

    const setDialogVisible = useDialogStore((state) => state.setDialogVisible);
    const [currentReplyId, setCurrentReplyId] = useState<string | null>(null);
    const [topLevelComments, setTopLevelComments] = useState<UiComment[]>([]);

    const commentItems: PostDTO[] = useMemo(
      () => data?.posts ?? [],
      [data],
    );

    const targetIds = useMemo(
      () => commentItems.map((item) => item.unitId).filter(Boolean),
      [commentItems],
    );

    const { data: myReactions } = useQuery({
      queryKey: ["reactions", "my", { targetIds }],
      queryFn: () => reactionApi.my({ targetIds }),
      enabled: !!user && targetIds.length > 0,
      staleTime: 1000 * 60,
    });

    const userReactionsByTarget = myReactions?.reactionsByTarget ?? {};

    useEffect(() => {
      try {
        const tree = buildTree(commentItems);
        setTopLevelComments(tree);
      } catch (_error) {
        console.error("Error building comment tree");
      }
    }, [commentItems]);

    const openDrawer = (id: string) => {
      setCurrentReplyId(id);
      setDialogVisible(id, true);
    };

    const createPostMutation = useCreatePostMutation({
      onSuccess: () => {
        showAlert("Comment created successfully");
      },
      onError: () => {
        showAlert("Failed to create comment");
      },
    });

    const updatePostMutation = useUpdatePostMutation({
      onSuccess: () => {
        showAlert("Comment updated successfully");
      },
      onError: () => {
        showAlert("Failed to update comment");
      },
    });

    const handleSubmit = (content: string) => {
      if (currentReplyId?.startsWith("update_")) {
        updatePostMutation.mutate({
          unitId: currentReplyId.replace("update_", ""),
          input: {
            body: content,
          },
        });
      } else {
        createPostMutation.mutate({
          targetUnitId: unitId,
          parentPostUnitId: currentReplyId || undefined,
          kindKey: 'comment',
          body: content,
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
                userReactionsByTarget={userReactionsByTarget}
              />
            ))
          ) : (
            <p>No comments</p>
          )}
        </Box>
        {currentReplyId && (
          <ReplyDrawerContainer
            dialogId={currentReplyId}
            onSubmit={(content: string) => handleSubmit(content)}
          />
        )}
      </>
    );
  }

  if (!user) return <div>{t("comment.login_to_view")}</div>;
  return <Core unitId={unitId} />;
}

export default TreeReplyComponents;
