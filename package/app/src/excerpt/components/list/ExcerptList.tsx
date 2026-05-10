import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { UnitDTO } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import { useMemo } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ExcerptCard } from "../item/ExcerptCard";

interface ExcerptListProps {
  units: UnitDTO[];
  /** MUI-style spacing scale (1 = 8px). Defaults to 2 (16px). */
  spacing?: number;
}

export const ExcerptList: React.FC<ExcerptListProps> = ({
  units,
  spacing = 2,
}) => {
  const { t } = useTranslation();
  const targetIds = useMemo(
    () => units.map((u) => u.id).filter(Boolean) as string[],
    [units],
  );
  useReactionHydration(targetIds);

  if (units.length === 0) {
    return <EmptyState title={t("excerpt.list.empty.title")} />;
  }

  return (
    <div className="flex flex-col" style={{ gap: `${spacing * 8}px` }}>
      {units.map((unit) => (
        <ExcerptCard key={unit.id} excerpt={unit} />
      ))}
    </div>
  );
};
