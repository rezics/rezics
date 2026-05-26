import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries, postSubtreeQuery } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import {
  common_edit,
  post_back_to_original_thread,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { PostCard } from "../components/item/PostCard";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { PostTreeList } from "../sections/PostTreeList";

const i18nMessages = {
  common_edit,
  post_back_to_original_thread,
};

export const ContinueThreadPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
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
  const editorEntry = useEditorEntry({
    surface: anchor?.kind === PostKind.WIKI ? "wikiPost" : "post",
    ownerUnit: { user: anchor?.author },
    capabilities:
      anchor?.kind === PostKind.WIKI ? ["content", "tag"] : undefined,
  });

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4 flex flex-col gap-4">
      <div className="mb-4">
        <Link to="/post/$rootPostUnitId" params={{ rootPostUnitId }}>
          <span className="text-xs text-text-brand">
            {m.post_back_to_original_thread()}
          </span>
        </Link>
      </div>
      {anchor && (
        <div className="flex flex-col gap-2">
          {editorEntry.canEnter ? (
            <div className="self-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={m.common_edit()}
                onClick={() =>
                  navigate({
                    to: "/post/$rootPostUnitId/continue/$unitId/edit",
                    params: { rootPostUnitId, unitId },
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <PostCard post={anchor} />
        </div>
      )}
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
