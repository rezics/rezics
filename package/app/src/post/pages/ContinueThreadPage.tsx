import { postQueries, postSubtreeQuery } from "@rezics/api/post/post";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { PostCard } from "../components/item/PostCard";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { PostTreeList } from "../sections/PostTreeList";
import { useMessage } from "@rezics/i18n/react";
import { post_back_to_original_thread } from "@rezics/i18n/messages";
const m = {
  post_back_to_original_thread,
};

const i18nMessages = {
  post_back_to_original_thread,
};

export const ContinueThreadPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const { rootPostUnitId, unitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
    unitId: string;
  };
  const composerRef = useFocusReplyFromQuery();
  const { data: anchor } = useQuery(postQueries.detail(unitId));
  const { data: subtree, isLoading } = useQuery(
    postSubtreeQuery(rootPostUnitId, unitId, {
      mode: "threaded",
      maxDepth: 5,
    }),
  );

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4 flex flex-col gap-4">
      <div className="mb-4">
        <Link to="/post/$rootPostUnitId" params={{ rootPostUnitId }}>
          <span className="text-xs text-text-brand">
            {m.post_back_to_original_thread()}
          </span>
        </Link>
      </div>
      {anchor && <PostCard post={anchor} />}
      {anchor && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={rootPostUnitId}
          parentPostUnitId={anchor.unitId}
        />
      )}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <PostTreeList
          posts={subtree?.posts ?? []}
          rootPostUnitId={rootPostUnitId}
          baseDepth={anchor?.depth ?? 0}
        />
      )}
    </div>
  );
};

export default ContinueThreadPage;
