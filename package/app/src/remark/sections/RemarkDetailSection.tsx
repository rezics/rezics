import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
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
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { RemarkDetail } from "../components/detail/RemarkDetail";

interface RemarkDetailSectionProps {
  remarkId: string;
}

export const RemarkDetailSection: React.FC<RemarkDetailSectionProps> = ({
  remarkId,
}) => {
  const { t } = useTranslation(["common"]);
  const composerRef = useFocusReplyFromQuery();
  const readContext = useReadLanguageContext();
  const { data: remark, isLoading } = useQuery({
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
  if (!remark) return <div>{t("common:no_data")}</div>;

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
