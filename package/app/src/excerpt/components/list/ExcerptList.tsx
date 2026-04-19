import { Stack } from "@mui/material";
import type { UnitDTO } from "@rezics/contract";
import type React from "react";
import { ExcerptCard } from "../item/ExcerptCard";

interface ExcerptListProps {
  units: UnitDTO[];
  spacing?: number | string;
}

export const ExcerptList: React.FC<ExcerptListProps> = ({
  units,
  spacing = 2,
}) => {
  return (
    <Stack spacing={spacing}>
      {units.map((unit) => (
        <ExcerptCard key={unit.id} excerpt={unit} />
      ))}
    </Stack>
  );
};
