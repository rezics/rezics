import { postQueries } from "@rezics/api/post/post";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { PostCard } from "../components/item/PostCard";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { PostTreeSection } from "../sections/PostTreeSection";

export const PostThreadPage: React.FC = () => {
  const { rootPostUnitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
  };
  const composerRef = useFocusReplyFromQuery();
  const { data: root } = useQuery(postQueries.detail(rootPostUnitId));

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4 flex flex-col gap-4">
      {root && <PostCard post={root} />}
      {root && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={root.unitId}
          parentPostUnitId={root.unitId}
        />
      )}
      <PostTreeSection rootPostUnitId={rootPostUnitId} />
    </div>
  );
};

export default PostThreadPage;
