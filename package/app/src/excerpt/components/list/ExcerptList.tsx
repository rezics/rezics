import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { UnitDTO } from "@rezics/contract";
import { excerpt_list_empty_title } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useMemo } from "react";
import { ExcerptCard } from "../item/ExcerptCard";

const i18nMessages = {
  excerpt_list_empty_title,
};

interface ExcerptListProps {
  units: UnitDTO[];
  /** MUI-style spacing scale (1 = 8px). Defaults to 2 (16px). */
  spacing?: number;
}

export const ExcerptList: React.FC<ExcerptListProps> = ({
  units,
  spacing = 2,
}) => {
  const m = useMessage(i18nMessages);
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
