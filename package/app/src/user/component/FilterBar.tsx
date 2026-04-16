import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import type { FC } from "react";

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
  <div
    className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}
  >
    {config.showSearch && (
      <TextField
        size="small"
        variant="outlined"
        placeholder={config.searchPlaceholder ?? "Search..."}
        value={values.q ?? ""}
        onChange={(e) => onChange("q", e.target.value)}
        className="min-w-[180px] flex-1 md:flex-none"
      />
    )}
    {config.dropdowns?.map((dd) => (
      <FormControl key={dd.key} size="small" className="min-w-[120px]">
        <InputLabel>{dd.label}</InputLabel>
        <Select
          label={dd.label}
          value={values[dd.key] ?? ""}
          onChange={(e) => onChange(dd.key, e.target.value as string)}
        >
          {dd.options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    ))}
  </div>
);
