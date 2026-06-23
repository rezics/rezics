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
import { QueryBoundary } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { TextLink } from "@/shared/ui/link";
import type { UnitPresentationContext } from "@/unit";
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
  presentationContext?: UnitPresentationContext;
};

/**
 * Post thread page — displays a single post with its detail, reply composer,
 * and nested comment thread. Max-width container with centered column layout.
 * 帖子线程页面：单个帖子的详情视图，包含帖子详情、回复编辑器和评论线程。
 *
 * Layout Structure:
 *
 * Mobile (<640px):
 *  +-----------------+
 *  | Realm breadcrumb| (conditional)
 *  +-----------------+
 *  |  Post Detail    |
 *  +-----------------+
 *  |  Edit button    | (if owner)
 *  +-----------------+
 *  | Reply Composer  |
 *  +-----------------+
 *  | Comments Thread | (scrollable, infinite load)
 *  +-----------------+
 *
 * Tablet (640-1023px):
 *  +--------------------+
 *  | Realm breadcrumb   | (conditional)
 *  +--------------------+
 *  | Edit button (right)|
 *  | Post Detail        |
 *  +--------------------+
 *  | Reply Composer     |
 *  +--------------------+
 *  | Comments Thread    |
 *  +--------------------+
 *
 * Desktop (1024-1535px):
 *  +------------------------+
 *  | Realm breadcrumb       | (conditional)
 *  | Edit button (right)    |
 *  +------------------------+
 *  | Post Detail            | (max-w-3xl centered)
 *  +------------------------+
 *  | Reply Composer         |
 *  +------------------------+
 *  | Comments Thread        | (nested, threaded)
 *  +------------------------+
 *
 * Ultra-wide (>=1536px):
 *  +----------------------------------+
 *  | Realm breadcrumb               |
 *  | Edit button (right)            |
 *  +----------------------------------+
 *  | Post Detail (max-w-3xl)        |
 *  +----------------------------------+
 *  | Reply Composer                 |
 *  +----------------------------------+
 *  | Comments Thread (threaded tree)|
 *  +----------------------------------+
 */
export const PostThreadPage: React.FC<PostThreadPageProps> = ({
  realmUnitId,
  defaultCommentContext,
  presentationContext,
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
    reactionContextUnitId,
  } = resolvePostDetailContext({ params, realmUnitId, presentationContext });
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

  // Primary post query — drives the QueryBoundary loading/error/not-found states.
  // 主帖子查询 —— 驱动 QueryBoundary 的加载/错误/未找到状态。
  const rootQuery = useQuery({
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
    summaryContextUnitId: reactionContextUnitId,
    userContextUnitId: reactionContextUnitId,
  });
  const focusPostUnitId = search?.focusPostUnitId ?? undefined;

  // editorEntry depends on root data; evaluated with optional chaining while
  // the query is pending, becomes fully resolved inside the render-prop.
  // editorEntry 依赖 root 数据；查询挂起时使用可选链安全求值，
  // 在渲染 prop 内部时已完全解析。
  const editorEntry = useEditorEntry({
    surface: rootQuery.data?.kind === PostKind.WIKI ? "wikiPost" : "post",
    ownerUnit: { user: rootQuery.data?.author },
    capabilities:
      rootQuery.data?.kind === PostKind.WIKI ? ["content", "tag"] : undefined,
  });

  return (
    <div className="mx-auto mt-8 w-full max-w-3xl px-4">
      <QueryBoundary query={rootQuery}>
        {(root) => (
          <div className="flex flex-col gap-4">
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
                summaryContextUnitId={reactionContextUnitId}
                reactionContextUnitId={reactionContextUnitId}
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
            <ReplyComposer
              ref={composerRef}
              mode="progressive"
              targetUnitId={root.targetUnitId ?? root.unitId}
              rootUnitId={root.unitId}
              realmUnitId={toCommentWriteRealmUnitId(commentContext)}
              parentCommentId={root.unitId}
            />
            <CommentThreadSection
              rootUnitId={rootPostUnitId}
              defaultContext={defaultContext}
              availableRealmUnitIds={[contextRealmUnitId, root.realmUnitId]}
              onContextChange={setPickedCommentContext}
              rootAuthorUserId={root.author?.unitId ?? root.authorUserId}
              summaryContextUnitId={reactionContextUnitId}
              reactionContextUnitId={reactionContextUnitId}
              focusPostUnitId={focusPostUnitId}
              highlightFocusedPost={Boolean(focusPostUnitId)}
            />
          </div>
        )}
      </QueryBoundary>
    </div>
  );
};
