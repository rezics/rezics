import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { scoreQueries } from "@rezics/api/score/score";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";

interface ScoreOverviewProps {
  unitId: string;
  realm?: string;
}

export const ScoreOverview: React.FC<ScoreOverviewProps> = ({
  unitId,
  realm = getDefaultRealmId() ?? "default",
}) => {
  const { t } = useTranslation(["community"]);
  const { data: aggregate, isLoading } = useQuery(
    scoreQueries.aggregate(unitId, realm),
  );

  // Show spinner while loading; only show "no ratings" after query settles
  // 加载中显示加载指示器；仅在查询完成后才显示"无评分"
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!aggregate) {
    return (
      <p className="text-sm text-text-secondary">
        {t("community:score_no_ratings")}
      </p>
    );
  }

  const average =
    aggregate.totalCount > 0 ? aggregate.totalScore / aggregate.totalCount : 0;
  const distribution = aggregate.distribution ?? {};
  const maxCount = Math.max(...Object.values(distribution).map(Number), 1);
  const averageVar =
    average >= 5
      ? "var(--colors-brand-fill)"
      : "var(--colors-sentiment-negative-text)";

  return (
    <div className="flex flex-row items-center gap-6">
      <div className="text-center min-w-[80px]">
        <div
          className="text-4xl font-bold leading-none"
          style={{ color: averageVar }}
        >
          {average.toFixed(1)}
        </div>
        <div className="text-xs text-text-secondary">
          {t("community:score_ratings_count", { count: aggregate.totalCount })}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        {Array.from({ length: 10 }, (_, i) => 10 - i).map((score) => {
          const count = Number(distribution[String(score)] ?? 0);
          const percent = (count / maxCount) * 100;
          const barVar =
            score >= 5
              ? "var(--colors-sentiment-positive-fill)"
              : "var(--colors-sentiment-negative-fill)";
          return (
            <div key={score} className="flex flex-row items-center gap-2">
              <span className="w-4 text-right text-xs text-text-secondary">
                {score}
              </span>
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{
                  backgroundColor:
                    "var(--colors-surface-subtle, rgba(0,0,0,0.06))",
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: barVar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
