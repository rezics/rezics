import { useMatchRoute } from "@tanstack/react-router";
import type React from "react";
import { ReviewDetailSection } from "../sections/ReviewDetailSection";

/**
 * 评论详情页面 - 显示单个评论或备注的详细信息
 *
 * 布局结构：
 * - 移动端 (<640px)：w-11/12（边距留出），max-w-4xl 约束，mt-16（顶部间距）
 * - 平板 (640-1023px)：mx-auto（中心），max-w-4xl，mt-16
 * - 桌面 (1024-1535px)：mx-auto（中心），max-w-4xl，mt-16
 * - 超宽 (>=1536px)：mx-auto（中心），max-w-4xl，mt-16
 *
 * ASCII 布局示意:
 *
 * All Viewports (centered with max-w-4xl)
 * +----------+
 * |          |
 * |REVIEW    |
 * |DETAIL    |
 * |SECTION   |
 * |          |
 * +----------+
 */
export const ReviewPage: React.FC = () => {
  const matchRoute = useMatchRoute();
  const reviewParams = matchRoute({ to: "/review/$reviewId", fuzzy: false });
  const remarkParams = matchRoute({ to: "/remark/$reviewId", fuzzy: false });
  const reviewId =
    (reviewParams ? reviewParams.reviewId : "") ||
    (remarkParams ? remarkParams.reviewId : "") ||
    "";

  return (
    <div className="w-full px-4 mx-auto mt-16 max-w-4xl">
      <ReviewDetailSection reviewId={reviewId} />
    </div>
  );
};
