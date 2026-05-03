import { Badge } from "@rezics/ui/shadcn";
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
      {chips.map((chip) => {
        const isActive = activeValue === chip.value;
        const label =
          chip.count != null ? `${chip.label} (${chip.count})` : chip.label;
        return (
          <Badge
            key={chip.value}
            variant={isActive ? "default" : "outline"}
            onClick={chip.disabled ? undefined : () => onChipChange(chip.value)}
            aria-disabled={chip.disabled || undefined}
            className={
              chip.disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer"
            }
          >
            {label}
          </Badge>
        );
      })}
    </div>
    {children}
  </div>
);
