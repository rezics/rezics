import { useEditorEntry } from "@rezics/api/hooks";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { PostListSection } from "@/post";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { Link } from "@/shared/ui/link";
import { ExcerptDetail } from "../components/detail/ExcerptDetail";

interface ExcerptDetailSectionProps {
  unitId: string;
}

export const ExcerptDetailSection: React.FC<ExcerptDetailSectionProps> = ({
  unitId,
}) => {
  const { t } = useTranslation(["common", "community"]);
const composerRef = useFocusReplyFromQuery();
  const { data: excerpt, isLoading } = useQuery(unitQueries.detail(unitId));
  const editorEntry = useEditorEntry({
    surface: "excerpt",
    ownerUnit: { user: excerpt?.user },
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (!excerpt?.id) {
    return (
      <div className="text-center py-16 text-error-text">
        {t("community:excerpt_not_found")}
      </div>
    );
  }

  const title = excerpt.translations?.[0]?.title;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center">
        {title && <h1 className="text-2xl font-bold">{title}</h1>}
        {editorEntry.canEnter && (
          <div className="ml-auto">
            <Link to="/excerpt/$unitId/edit" params={{ unitId }}>
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
      </div>

      <ExcerptDetail excerpt={excerpt} onReplyInvoke={handleReplyInvoke} />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AccentBar />
          <h2 className="text-xl font-bold">{t("community:review_comments")}</h2>
        </div>
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={unitId}
        />
        <PostListSection targetUnitId={unitId} />
      </div>
    </div>
  );
};
