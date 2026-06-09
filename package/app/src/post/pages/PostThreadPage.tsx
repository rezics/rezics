import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import { realmDetailQuery } from "@rezics/api/realm/realm";
import { type CommentListContext, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  CommentThreadSection,
  ReplyComposer,
  resolveDefaultCommentContext,
  toCommentWriteRealmUnitId,
  useFocusReplyFromQuery,
} from "@/comment";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { TextLink } from "@/shared/ui/link";
import { PostDetail } from "../components/detail/PostDetail";
import { resolvePostDetailContext } from "../models/postDetailContext";

export type PostThreadPageProps = {
  realmUnitId?: string | null;
  /**
   * Comment-context default for zone-framed routes (the zone's
   * `config.context`). Realm/direct routes derive their default from the
   * resolved post-detail context instead.
   * 专区路由的评论语境默认值（专区的 `config.context`）。realm/直接路由
   * 则从解析出的帖子详情语境推导默认值。
   */
  defaultCommentContext?: CommentListContext;
};

export const PostThreadPage: React.FC<PostThreadPageProps> = ({
  realmUnitId,
  defaultCommentContext,
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
    context,
    realmUnitId: contextRealmUnitId,
    reactionScopeKey,
  } = resolvePostDetailContext({ params, realmUnitId });
  const defaultContext =
    defaultCommentContext ?? resolveDefaultCommentContext(context);
  // Mirrors the thread section's uncontrolled selector so the root composer
  // writes into the partition the user is currently viewing.
  // 镜像线程区块的非受控选择器，使根级编辑器写入用户当前查看的分区。
  const [pickedCommentContext, setPickedCommentContext] =
    useState<CommentListContext | null>(null);
  const commentContext = pickedCommentContext ?? defaultContext;
  const search = useSearch({ strict: false }) as
    | { focusPostUnitId?: string | null }
    | undefined;
  const composerRef = useFocusReplyFromQuery();
  const readContext = useReadLanguageContext();
  const { data: root } = useQuery({
    ...postQueries.detail(rootPostUnitId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(rootPostUnitId),
  });
  const { data: realm } = useQuery({
    ...realmDetailQuery(contextRealmUnitId ?? "", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled:
      readContext.ready &&
      context.kind === "realm" &&
      Boolean(contextRealmUnitId),
  });
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
      {context.kind === "realm" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border-whisper pb-3">
          <TextLink
            to="/realm/$realmId"
            params={{ realmId: context.realmUnitId }}
            underline="none"
            className="inline-flex min-w-0 items-center gap-2 text-sm leading-ui text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">
              {realm?.title ?? context.realmUnitId}
            </span>
          </TextLink>
        </div>
      ) : null}
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
                  context.kind === "realm"
                    ? navigate({
                        to: "/realm/$realmId/post/$postUnitId/edit",
                        params: {
                          realmId: context.realmUnitId,
                          postUnitId: rootPostUnitId,
                        },
                      })
                    : navigate({
                        to: "/post/$rootPostUnitId/edit",
                        params: { rootPostUnitId },
                      })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <PostDetail
            post={root}
            summaryScopeKey={reactionScopeKey}
            reactionScopeKey={reactionScopeKey}
            onReplyInvoke={() =>
              navigate({
                to:
                  context.kind === "realm"
                    ? "/realm/$realmId/post/$postUnitId"
                    : "/post/$rootPostUnitId",
                params:
                  context.kind === "realm"
                    ? {
                        realmId: context.realmUnitId,
                        postUnitId: rootPostUnitId,
                      }
                    : { rootPostUnitId },
                search: { focus: "reply" },
              })
            }
          />
        </div>
      )}
      {root && (
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={root.targetUnitId ?? root.unitId}
          rootUnitId={root.unitId}
          realmUnitId={toCommentWriteRealmUnitId(commentContext)}
          parentCommentId={root.unitId}
        />
      )}
      <CommentThreadSection
        rootUnitId={rootPostUnitId}
        defaultContext={defaultContext}
        availableRealmUnitIds={[contextRealmUnitId, root?.realmUnitId]}
        onContextChange={setPickedCommentContext}
        rootAuthorUserId={root?.author?.unitId ?? root?.authorUserId}
        summaryScopeKey={reactionScopeKey}
        reactionScopeKey={reactionScopeKey}
        focusPostUnitId={focusPostUnitId}
        highlightFocusedPost={Boolean(focusPostUnitId)}
      />
    </div>
  );
};
