import { useEditorEntry } from "@rezics/contract/api/hooks";
import { postQueries } from "@rezics/contract/api/post/post";
import type { CommentListContext } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  COMMENT_CONTEXT_ALL,
  CommentThreadSection,
  ReplyComposer,
  toCommentWriteRealmUnitId,
  useFocusReplyFromQuery,
} from "@/comment";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { RemarkDetail } from "../components/detail/RemarkDetail";

interface RemarkDetailSectionProps {
  remarkId: string;
}

/**
 * Remark (post) detail section.
 *
 * Displays a remark with edit button (if authorized), a reply composer,
 * and a threaded comment section. Comment context selector defaults to All.
 *
 * 备注详情区域，显示备注内容、编辑按钮（如有权限）、回复框和评论线程。
 * 评论分区选择器默认为"全部"。
 *
 * Desktop (1200px):
 * +-----------------------------------------------+
 * | [Edit icon]                                  |
 * +-----------------------------------------------+
 * | Remark Title                                 |
 * | Author | Date                                |
 * | Remark content text here...                  |
 * +-----------------------------------------------+
 * | + Reply Composer                             |
 * | [____________________________]                |
 * | [Cancel]              [Post]                 |
 * +-----------------------------------------------+
 * | Comments                                     |
 * | [All] [Realm A] [Realm B]                    |
 * | - Comment 1                                  |
 * |   - Reply 1                                  |
 * +-----------------------------------------------+
 *
 * Tablet (768px):
 * +---------------------------------+
 * | [Edit]                          |
 * +---------------------------------+
 * | Remark Title                    |
 * | Author | Date                   |
 * | Remark content...               |
 * +---------------------------------+
 * | Reply Composer                  |
 * | [_____________________]          |
 * | [Cancel]     [Post]             |
 * +---------------------------------+
 * | Comments                        |
 * | [All] [Realm A]                 |
 * | - Comment 1                     |
 * +---------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | [Edit]   |
 * +----------+
 * | Title    |
 * | Author   |
 * | Content  |
 * +----------+
 * | Reply    |
 * | [_____]  |
 * | [Post]   |
 * +----------+
 * | Comments |
 * | [All]    |
 * | Cmts...  |
 * +----------+
 *
 * Loading State:
 * +----------+
 * | Loading...|
 * +----------+
 */
export const RemarkDetailSection: React.FC<RemarkDetailSectionProps> = ({
  remarkId,
}) => {
  const { t } = useTranslation(["common"]);
  const composerRef = useFocusReplyFromQuery();
  const readContext = useReadLanguageContext();
  const {
    data: remark,
    isLoading,
    error,
  } = useQuery({
    ...postQueries.detail(remarkId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(remarkId),
  });
  const editorEntry = useEditorEntry({
    surface: "remark",
    ownerUnit: { user: remark?.author },
  });
  // Direct unit surface: the selector defaults to All; the root composer
  // mirrors the user's pick so new comments target the selected partition.
  // 直接 Unit 界面：选择器默认为“全部”；根级编辑器镜像用户的选择，使新
  // 评论写入所选分区。
  const [pickedCommentContext, setPickedCommentContext] =
    useState<CommentListContext | null>(null);
  const commentContext = pickedCommentContext ?? COMMENT_CONTEXT_ALL;

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" />
    ) : (
      <QueryErrorDisplay error={error} />
    );
  }
  if (!remark) return <ResourceNotFoundState variant="section" />;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      {editorEntry.canEnter && (
        <div className="self-end">
          <Link to="/remark/$reviewId/edit" params={{ reviewId: remarkId }}>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("common:edit")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
      <RemarkDetail remark={remark} onReplyInvoke={handleReplyInvoke} />
      <ReplyComposer
        ref={composerRef}
        mode="progressive"
        targetUnitId={remark.targetUnitId ?? remark.unitId}
        rootUnitId={remark.unitId}
        realmUnitId={toCommentWriteRealmUnitId(commentContext)}
        parentCommentId={remark.unitId}
      />
      <CommentThreadSection
        rootUnitId={remark.unitId}
        defaultContext={COMMENT_CONTEXT_ALL}
        availableRealmUnitIds={[remark.realmUnitId]}
        onContextChange={setPickedCommentContext}
        rootAuthorUserId={remark.author?.unitId ?? remark.authorUserId}
      />
    </div>
  );
};
