import { Stack } from "@mui/material";
import type { UnitDTO } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ExcerptCard } from "../item/ExcerptCard";

interface ExcerptListProps {
  units: UnitDTO[];
  spacing?: number | string;
}

export const ExcerptList: React.FC<ExcerptListProps> = ({
  units,
  spacing = 2,
}) => {
  const { t } = useTranslation();

  if (units.length === 0) {
    return <EmptyState title={t("excerpt.list.empty.title")} />;
  }

  return (
    <Stack spacing={spacing}>
      {units.map((unit) => (
        <ExcerptCard key={unit.id} excerpt={unit} />
      ))}
    </Stack>
  );
};
