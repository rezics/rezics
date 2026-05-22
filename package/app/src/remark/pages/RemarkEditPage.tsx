import { postQueries } from "@rezics/api/post/post";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkEditDialog } from "../forms/RemarkEditDialog";
import * as m from "@rezics/i18n/messages";

interface RemarkEditPageProps {
  reviewId: string;
}

export const RemarkEditPage: React.FC<RemarkEditPageProps> = ({ reviewId }) => {
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
