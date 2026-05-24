import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { UnitDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useMemo } from "react";
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
  const targetIds = useMemo(
    () => units.map((u) => u.id).filter(Boolean) as string[],
    [units],
  );
  useReactionHydration(targetIds);

  if (units.length === 0) {
    return <EmptyState title={m.excerpt_list_empty_title()} />;
  }

  return (
    <div className="flex flex-col" style={{ gap: `${spacing * 8}px` }}>
      {units.map((unit) => (
        <ExcerptCard key={unit.id} excerpt={unit} />
      ))}
    </div>
  );
};
