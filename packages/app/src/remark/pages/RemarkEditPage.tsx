import { postQueries } from "@rezics/contract/api/post/post.queries";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { RemarkEditDialog } from "../forms/RemarkEditDialog";

interface RemarkEditPageProps {
  reviewId: string;
}

/**
 * Remark (post) editing page.
 *
 * Fetches a remark by ID and displays the edit dialog in a full-page route.
 * Closes and navigates back on save or dismiss.
 *
 * 编辑页面用于修改一条备注（post）。通过 ID 获取备注内容，
 * 在全屏对话框中编辑。保存或关闭时返回到详情页面。
 *
 * Desktop:
 * +-------------------------------------+
 * |  < Remark Edit                      |
 * +-------------------------------------+
 * | Title  [__________________]         |
 * | Content                             |
 * | [_________________________]          |
 * | [_________________________]          |
 * | [Cancel]              [Save]        |
 * +-------------------------------------+
 *
 * Tablet (600px):
 * +---------------------------+
 * | < Remark Edit             |
 * +---------------------------+
 * | Title  [___________]      |
 * | Content                   |
 * | [___________________]     |
 * | [Cancel]    [Save]        |
 * +---------------------------+
 *
 * Mobile (360px):
 * +--------------+
 * | < Edit       |
 * +--------------+
 * | Title        |
 * | [________]   |
 * | Content      |
 * | [______]     |
 * | [Dismiss]    |
 * | [Save]       |
 * +--------------+
 *
 * Loading State (360px):
 * +--------------+
 * | < Edit       |
 * +--------------+
 * | Loading...   |
 * +--------------+
 */
export const RemarkEditPage: React.FC<RemarkEditPageProps> = ({ reviewId }) => {
  const { t } = useTranslation(["common"]);
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(postQueries.detail(reviewId));

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" />
    ) : (
      <QueryErrorDisplay error={error} />
    );
  }
  if (!data) return <ResourceNotFoundState variant="section" />;

  const handleClose = () => {
    navigate({ to: "/remark/$reviewId", params: { reviewId } });
  };

  return <RemarkEditDialog remark={data} open onClose={handleClose} />;
};
