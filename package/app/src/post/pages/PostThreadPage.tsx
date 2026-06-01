import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type React from "react";
import { PostCard } from "../components/item/PostCard";
import { ReplyComposer } from "../forms/ReplyComposer";
import { useFocusReplyFromQuery } from "../hooks/useFocusReplyFromQuery";
import { resolvePostThreadContext } from "../models/postThreadContext";
import { PostTreeSection } from "../sections/PostTreeSection";

export type PostThreadPageProps = {
  realmUnitId?: string | null;
};

export const PostThreadPage: React.FC<PostThreadPageProps> = ({
  realmUnitId,
}) => {
  const { t } = useTranslation(["common"]);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as {
    rootPostUnitId?: string;
    postUnitId?: string;
    realmId?: string;
  };
  const {
    rootPostUnitId,
    realmUnitId: contextRealmUnitId,
    reactionScopeKey,
  } = resolvePostThreadContext({ params, realmUnitId });
  const search = useSearch({ strict: false }) as
    | { focusPostUnitId?: string | null }
    | undefined;
  const composerRef = useFocusReplyFromQuery();
  const { data: root } = useQuery(postQueries.detail(rootPostUnitId));
  useReactionHydration(rootPostUnitId ? [rootPostUnitId] : [], {
    summaryScopeKey: reactionScopeKey,
    userScopeKey: reactionScopeKey,
  });
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
                aria-label={t("common:edit")}
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
          <PostCard
            post={root}
            summaryScopeKey={reactionScopeKey}
            reactionScopeKey={reactionScopeKey}
          />
        </div>
      )}
      {root && contextRealmUnitId && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={root.targetUnitId ?? root.unitId}
          rootUnitId={root.unitId}
          realmUnitId={contextRealmUnitId}
          parentCommentUnitId={root.unitId}
        />
      )}
      <PostTreeSection
        rootUnitId={rootPostUnitId}
        realmUnitId={contextRealmUnitId}
        summaryScopeKey={reactionScopeKey}
        reactionScopeKey={reactionScopeKey}
        focusPostUnitId={focusPostUnitId}
        highlightFocusedPost={Boolean(focusPostUnitId)}
      />
    </div>
  );
};

export default PostThreadPage;
