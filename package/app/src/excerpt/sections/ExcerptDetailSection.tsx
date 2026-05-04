import { useCanEdit } from "@rezics/api/hooks";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostTreeSection } from "@/post";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { ExcerptDetail } from "../components/detail/ExcerptDetail";

interface ExcerptDetailSectionProps {
  unitId: string;
}

export const ExcerptDetailSection: React.FC<ExcerptDetailSectionProps> = ({
  unitId,
}) => {
  const { t } = useTranslation();
  const composerRef = useFocusReplyFromQuery();
  const { data: excerpt, isLoading } = useQuery(unitQueries.detail(unitId));
  const canEdit = useCanEdit({
    resource: "unit",
    ownerUnit: { user: excerpt?.user },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (!excerpt?.id) {
    return (
      <div className="text-center py-16 text-rezics-color-danger">
        {t("excerpt.not_found")}
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
        {canEdit && (
          <div className="ml-auto">
            <TextLink to="/excerpt/$unitId/edit" params={{ unitId }}>
              {t("common.edit")}
            </TextLink>
          </div>
        )}
      </div>

      <ExcerptDetail excerpt={excerpt} onReplyInvoke={handleReplyInvoke} />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AccentBar />
          <h2 className="text-xl font-bold">{t("review.comments")}</h2>
        </div>
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={unitId}
        />
        <PostTreeSection rootPostUnitId={unitId} />
      </div>
    </div>
  );
};
