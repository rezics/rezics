import { useReactionHydration } from "@rezics/contract/api/reaction/useReactionHydration";
import type { UnitDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useMemo } from "react";
import { ExcerptCard } from "../item/ExcerptCard";

interface ExcerptListProps {
  units: UnitDTO[];
  /**
   * MUI-style spacing scale (1 = 8px). Defaults to 2 (16px).
   * MUI 风格的间距比例（1 = 8px）。默认为 2（16px）。
   */
  spacing?: number;
}

export const ExcerptList: React.FC<ExcerptListProps> = ({
  units,
  spacing = 2,
}) => {
  const { t } = useTranslation(["community"]);
  const targetIds = useMemo(
    () => units.map((u) => u.id).filter(Boolean) as string[],
    [units],
  );
  useReactionHydration(targetIds);

  if (units.length === 0) {
    return <EmptyState title={t("community:excerpt_list_empty_title")} />;
  }

  return (
    <div className="flex flex-col" style={{ gap: `${spacing * 8}px` }}>
      {units.map((unit) => (
        <ExcerptCard key={unit.id} excerpt={unit} />
      ))}
    </div>
  );
};
