import { Avatar } from "@mui/material";
import { postQueries } from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useRef } from "react";

/**
 * ReplyComponents - Flat comment list.
 * Now uses Post API instead of old Comment API.
 */
interface ReplyComponentsProps {
  bookListId: string;
}

export const ReplyComponents: React.FC<ReplyComponentsProps> = ({
  bookListId,
}) => {
  // Fetch flat posts for this target
  const { data } = useQuery({
    ...postQueries.byTarget(bookListId, {
      kindKey: 'comment',
      mode: 'flat',
      limit: 200,
    }),
    enabled: !!bookListId,
  });

  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const allComments: PostDTO[] = data?.posts || [];

  const scrollToComment = useCallback((commentId: string) => {
    window.location.hash = `comment-${commentId}`;
  }, []);

  const getParentPreview = (parentId: string) => {
    const parent = allComments.find((c) => c.unitId === parentId);
    if (parent) {
      return `${parent.body?.slice(0, 10)}...`;
    }
    return "";
  };

  return (
    <div className="p-4 space-y-4">
      {allComments.map((comment) => (
        <div
          key={comment.unitId}
          id={`comment-${comment.unitId}`}
          className="flex gap-3 items-start"
          ref={(el) => {
            commentRefs.current[comment.unitId] = el;
          }}
        >
          <Avatar src={comment.author?.avatar ?? undefined} className="w-8 h-8" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-red-800">
                {comment.author?.name ?? 'Unknown'}
              </span>
              <span className="text-xs text-gray-500">#{comment.unitId.slice(-6)}</span>
              <span className="text-xs text-gray-500">
                {comment.createdAt
                  ? new Date(String(comment.createdAt)).toLocaleString()
                  : ''}
              </span>
            </div>
            {comment.parentPostUnitId && (
              <div className="text-xs text-blue-500 mt-1">
                回复{" "}
                <a
                  href={`#comment-${comment.parentPostUnitId}`}
                  className="hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToComment(comment.parentPostUnitId!);
                  }}
                >
                  #{comment.parentPostUnitId.slice(-6)}{" "}
                  {getParentPreview(comment.parentPostUnitId)}
                </a>
              </div>
            )}
            <p className="mt-1">{comment.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReplyComponents;
