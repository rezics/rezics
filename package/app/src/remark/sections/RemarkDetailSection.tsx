import { Box } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostTreeSection } from "@/post/sections/PostTreeSection";
import { RemarkDetail } from "../components/detail/RemarkDetail";

interface RemarkDetailSectionProps {
  remarkId: string;
}

export const RemarkDetailSection: React.FC<RemarkDetailSectionProps> = ({
  remarkId,
}) => {
  const { t } = useTranslation();
  const { data: remark, isLoading } = useQuery(postQueries.detail(remarkId));
  const canEdit = useCanEdit({
    resource: "post",
    ownerUnit: { user: remark?.author },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (!remark) return <div>{t("common.no_data")}</div>;

  return (
    <Box className="flex flex-col gap-6">
      {canEdit && (
        <Box alignSelf="flex-end">
          <MUILink to="/remark/$reviewId/edit" params={{ reviewId: remarkId }}>
            {t("common.edit")}
          </MUILink>
        </Box>
      )}
      <RemarkDetail remark={remark} />
      <PostTreeSection rootPostUnitId={remark.unitId} />
    </Box>
  );
};
