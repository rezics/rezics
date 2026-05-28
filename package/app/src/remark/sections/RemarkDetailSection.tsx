import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { PostTreeSection } from "@/post/sections/PostTreeSection";
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
  const { data: remark, isLoading } = useQuery(postQueries.detail(remarkId));
  const editorEntry = useEditorEntry({
    surface: "remark",
    ownerUnit: { user: remark?.author },
  });

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
        targetUnitId={remark.unitId}
        parentPostUnitId={remark.unitId}
      />
      <PostTreeSection rootPostUnitId={remark.unitId} />
    </div>
  );
};
