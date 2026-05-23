import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type { FC } from "react";
import * as m from "@rezics/i18n/messages";

export interface FilterDropdownConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface FilterBarConfig {
  showSearch?: boolean;
  searchPlaceholder?: string;
  dropdowns?: FilterDropdownConfig[];
}

interface FilterBarProps {
  config: FilterBarConfig;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  className?: string;
}

export const FilterBar: FC<FilterBarProps> = ({
  config,
  values,
  onChange,
  className,
}) => (
  <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
    {config.showSearch && (
      <Input
        placeholder={config.searchPlaceholder ?? m.common_search()}
        value={values.q ?? ""}
        onChange={(e) => onChange("q", e.target.value)}
        className="min-w-[180px] flex-1 md:flex-none h-9"
      />
    )}
    {config.dropdowns?.map((dd) => (
      <Select
        key={dd.key}
        value={values[dd.key] ?? ""}
        onValueChange={(value) => {
          if (value != null) onChange(dd.key, value);
        }}
      >
        <SelectTrigger className="min-w-[120px] h-9">
          <SelectValue placeholder={dd.label} />
        </SelectTrigger>
        <SelectContent>
          {dd.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ))}
  </div>
);
