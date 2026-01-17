// 暂时就先这样不处理，后面树化，或者使用VirtualList

import { commentQueries } from '@/api/comment/comment.queries.ts';
import { Avatar } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useRef } from "react";
// import { scrollToElementWithOffsetUniversal } from "@/util/domUtils";

interface ReplyComponentsProps {
  bookListId: string;
}

export const ReplyComponents: React.FC<ReplyComponentsProps> = ({
  bookListId,
}) => {
  const commentId = bookListId; // TODO 暫時先用這個替代
  const { data, isLoading, error } = useQuery(
    commentQueries.unitCommentTree(commentId, {
      // Fetch up to depth 3 for an initial view; adjust as needed
      maxDepth: 100,
      order: 'asc',
      start: 0,
      limit: 200,
    }),
  );
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const allComments = data?.items || [];

  // 滚动到指定评论
  const scrollToComment = useCallback((commentId: string) => {
    window.location.hash = `comment-${commentId}`;
    // setTimeout(() => {
    //     // scrollToElementWithOffset(`#comment-${commentId}`, 100, "auto");
    //     // scrollToElementWithOffsetUniversal(`#comment-${commentId}`, 100, "auto");
    // }, 1000);
  }, []);

  // 获取父评论内容预览
  const getParentPreview = (parentId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = allComments.find((c: any) => c.id === parentId);
    if (parent) {
      return parent.content?.slice(0, 10) + "...";
    }
    return "";
  };

  return (
    <div className="p-4 space-y-4">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {allComments.map((comment: any) => (
        <div
          key={comment.id}
          id={`comment-${comment.id}`}
          className="flex gap-3 items-start"
          ref={(el) => {
            commentRefs.current[comment.id] = el;
          }}
        >
          <Avatar src={comment.avatar} className="w-8 h-8" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-red-800">
                {comment.author}
              </span>
              <span className="text-xs text-gray-500">
                #{comment.id}
              </span>
              <span className="text-xs text-gray-500">
                {comment.created_at}
              </span>
            </div>
            {comment.parent_id && (
              <div className="text-xs text-blue-500 mt-1">
                回复{" "}
                <a
                  href={`#comment-${comment.parent_id}`}
                  className="hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToComment(comment.parent_id);
                  }}
                >
                  #{comment.parent_id} {getParentPreview(comment.parent_id)}
                </a>
              </div>
            )}
            <p className="mt-1">{comment.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReplyComponents;
