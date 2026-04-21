import { Box, Typography } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
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
      <div className="text-center py-10 text-red-500">
        {t("excerpt.not_found")}
      </div>
    );
  }

  const title = excerpt.translations?.[0]?.title;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <Box className="flex flex-col gap-6">
      <Box className="flex items-center">
        {title && (
          <Typography variant="h5" fontWeight={700}>
            {title}
          </Typography>
        )}
        {canEdit && (
          <Box ml="auto">
            <MUILink to="/excerpt/$unitId/edit" params={{ unitId }}>
              {t("common.edit")}
            </MUILink>
          </Box>
        )}
      </Box>

      <ExcerptDetail excerpt={excerpt} onReplyInvoke={handleReplyInvoke} />

      <Box className="mt-4 flex flex-col gap-3">
        <Box className="flex items-center gap-2">
          <AccentBar />
          <Typography variant="h6" fontWeight={700}>
            {t("review.comments")}
          </Typography>
        </Box>
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={unitId}
        />
        <PostTreeSection rootPostUnitId={unitId} />
      </Box>
    </Box>
  );
};
