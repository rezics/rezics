import { postQueries } from "@rezics/api/post/post";
import { common_loading, common_no_data } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkEditDialog } from "../forms/RemarkEditDialog";

const i18nMessages = {
  common_loading,
  common_no_data,
};

interface RemarkEditPageProps {
  reviewId: string;
}

export const RemarkEditPage: React.FC<RemarkEditPageProps> = ({ reviewId }) => {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(postQueries.detail(reviewId));

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!data) return <div>{m.common_no_data()}</div>;

  const handleClose = () => {
    navigate({ to: "/remark/$reviewId", params: { reviewId } });
  };

  return <RemarkEditDialog remark={data} open onClose={handleClose} />;
};

export default RemarkEditPage;
