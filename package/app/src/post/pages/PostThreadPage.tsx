import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { common_edit } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type React from "react";
import { PostCard } from "../components/item/PostCard";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { PostTreeSection } from "../sections/PostTreeSection";

export const PostThreadPage: React.FC = () => {
  const m = useMessage({ common_edit });
  const navigate = useNavigate();
  const { rootPostUnitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
  };
  const search = useSearch({ strict: false }) as
    | { focusPostUnitId?: string | null }
    | undefined;
  const composerRef = useFocusReplyFromQuery();
  const { data: root } = useQuery(postQueries.detail(rootPostUnitId));
  const focusPostUnitId = search?.focusPostUnitId ?? undefined;
  const editorEntry = useEditorEntry({
    surface: root?.kind === PostKind.WIKI ? "wikiPost" : "post",
    ownerUnit: { user: root?.author },
    capabilities: root?.kind === PostKind.WIKI ? ["content", "tag"] : undefined,
  });

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4 flex flex-col gap-4">
      {root && (
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
                    to: "/post/$rootPostUnitId/edit",
                    params: { rootPostUnitId },
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <PostCard post={root} />
        </div>
      )}
      {root && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={root.unitId}
          parentPostUnitId={root.unitId}
        />
      )}
      <PostTreeSection
        rootPostUnitId={rootPostUnitId}
        focusPostUnitId={focusPostUnitId}
        highlightFocusedPost={Boolean(focusPostUnitId)}
      />
    </div>
  );
};

export default PostThreadPage;
