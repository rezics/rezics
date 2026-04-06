import { mapUnitListToReviewListResponse } from "@rezics/api/meili/meili.api";
import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { UnitType } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ShortReviewListShow } from "@/review/component/ShortReviewList.tsx";

interface ShortBookReviewsProps {
  bookId: string;
}

// 短评就是Post评论

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.REMARK,
      start: 0,
      targetUnitId: bookId,
      keyword: "",
      limit: 4,
      mapFn: mapUnitListToReviewListResponse,
      options: { enabled: !!bookId },
    }),
  );

  const handleLike = (reviewId: string) => {
    console.log("Like review:", reviewId);
  };

  const handleDislike = (reviewId: string) => {
    console.log("Dislike review:", reviewId);
  };

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error && error instanceof Error) {
    return (
      <div>
        {t("common.error")}: {error.message}
      </div>
    );
  }

  return (
    <ShortReviewListShow
      data={{ reviews: data?.reviews?.slice(0, 4) || [], total: data?.total }}
      onLike={handleLike}
      onDislike={handleDislike}
    />
  );
};
