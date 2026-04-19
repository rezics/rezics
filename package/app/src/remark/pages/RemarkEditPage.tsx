import { postQueries } from "@rezics/api/post/post";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkEditDialog } from "../forms/RemarkEditDialog";

interface RemarkEditPageProps {
  reviewId: string;
}

export const RemarkEditPage: React.FC<RemarkEditPageProps> = ({ reviewId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(postQueries.detail(reviewId));

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!data) return <div>{t("common.no_data")}</div>;

  const handleClose = () => {
    navigate({ to: "/remark/$reviewId", params: { reviewId } });
  };

  return <RemarkEditDialog remark={data} open onClose={handleClose} />;
};

export default RemarkEditPage;
