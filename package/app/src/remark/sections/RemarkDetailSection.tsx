import { useCanEdit } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { PostTreeSection } from "@/post/sections/PostTreeSection";
import { TextLink } from "@/shared/ui/link";
import { RemarkDetail } from "../components/detail/RemarkDetail";
import { useMessage } from "@rezics/i18n/react";
import {
  common_edit,
  common_loading,
  common_no_data,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_edit,
  common_loading,
  common_no_data,
};

interface RemarkDetailSectionProps {
  remarkId: string;
}

export const RemarkDetailSection: React.FC<RemarkDetailSectionProps> = ({
  remarkId,
}) => {
  const m = useMessage(i18nMessages);
  const composerRef = useFocusReplyFromQuery();
  const { data: remark, isLoading } = useQuery(postQueries.detail(remarkId));
  const canEdit = useCanEdit({
    resource: "post",
    ownerUnit: { user: remark?.author },
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (!remark) return <div>{m.common_no_data()}</div>;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      {canEdit && (
        <div className="self-end">
          <TextLink to="/remark/$reviewId/edit" params={{ reviewId: remarkId }}>
            {m.common_edit()}
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
