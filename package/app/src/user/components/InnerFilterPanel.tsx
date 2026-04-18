import { Chip } from "@mui/material";
import type { FC, ReactNode } from "react";

export interface ChipDefinition {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface InnerFilterPanelProps {
  chips: ChipDefinition[];
  activeValue: string;
  onChipChange: (value: string) => void;
  children?: ReactNode;
  className?: string;
}

export const InnerFilterPanel: FC<InnerFilterPanelProps> = ({
  chips,
  activeValue,
  onChipChange,
  children,
  className,
}) => (
  <div className={`flex flex-col gap-3 ${className ?? ""}`}>
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Chip
          key={chip.value}
          label={
            chip.count != null ? `${chip.label} (${chip.count})` : chip.label
          }
          variant={activeValue === chip.value ? "filled" : "outlined"}
          color={activeValue === chip.value ? "primary" : "default"}
          onClick={chip.disabled ? undefined : () => onChipChange(chip.value)}
          disabled={chip.disabled}
          clickable={!chip.disabled}
        />
      ))}
    </div>
    {children}
  </div>
);
