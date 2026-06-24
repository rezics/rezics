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

/**
 * 内部过滤面板，显示可选择的徽章芯片和子内容。
 * Inner filter panel with selectable badge chips and optional children content.
 *
 * All breakpoints:
 * +----------------------------------+
 * | [Chip1] [Chip2] [Chip3]         |
 * | [Chip4] ...                     |
 * +----------------------------------+
 * | 子内容 (可选)                    |
 * +----------------------------------+
 *
 * 芯片采用 flex-wrap 自动换行，gap-2 控制间距。
 * Chips wrap horizontally with gap-2; children render below if provided.
 * 禁用芯片显示 50% 不透明度和禁用光标。
 * Disabled chips show 50% opacity and disabled cursor.
 */
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
        const activate = () => {
          if (!chip.disabled) onChipChange(chip.value);
        };
        return (
          <Badge
            key={chip.value}
            variant={isActive ? "default" : "outline"}
            role="button"
            tabIndex={chip.disabled ? -1 : 0}
            aria-pressed={isActive}
            aria-disabled={chip.disabled || undefined}
            onClick={chip.disabled ? undefined : activate}
            onKeyDown={(event) => {
              if (chip.disabled) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }}
            className={
              chip.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
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
