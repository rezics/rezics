import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { scoreQueries } from "@rezics/api/score/score";
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
  const { data: aggregates } = useQuery(scoreQueries.aggregates(unitId));

  const aggregate =
    aggregates?.find((a) => a.realm === realm) ?? aggregates?.[0];

  if (!aggregate) {
    return (
      <p className="text-sm text-text-secondary">No ratings yet</p>
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
          {aggregate.totalCount} ratings
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
                  backgroundColor: "var(--colors-surface-subtle, rgba(0,0,0,0.06))",
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
