import { useCanEdit } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { PostTreeSection } from "@/post/sections/PostTreeSection";
import { RemarkDetail } from "../components/detail/RemarkDetail";

interface RemarkDetailSectionProps {
  remarkId: string;
}

export const RemarkDetailSection: React.FC<RemarkDetailSectionProps> = ({
  remarkId,
}) => {
  const { t } = useTranslation();
  const composerRef = useFocusReplyFromQuery();
  const { data: remark, isLoading } = useQuery(postQueries.detail(remarkId));
  const canEdit = useCanEdit({
    resource: "post",
    ownerUnit: { user: remark?.author },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (!remark) return <div>{t("common.no_data")}</div>;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      {canEdit && (
        <div className="self-end">
          <TextLink to="/remark/$reviewId/edit" params={{ reviewId: remarkId }}>
            {t("common.edit")}
          </TextLink>
        </div>
      )}
      <RemarkDetail remark={remark} onReplyInvoke={handleReplyInvoke} />
      <ReplyComposer
        ref={composerRef}
        mode="progressive"
        targetUnitId={remark.unitId}
        parentPostUnitId={remark.unitId}
      />
      <PostTreeSection rootPostUnitId={remark.unitId} />
    </div>
  );
};
