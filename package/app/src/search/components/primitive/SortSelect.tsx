import { MenuItem, TextField } from "@mui/material";
import type React from "react";

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "createdAt", label: "Newest" },
  { value: "updatedAt", label: "Recently Updated" },
  { value: "publishedAt", label: "Publication Date" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export type SortSelectProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options?: readonly { value: string; label: string }[];
  label?: string;
  size?: "small" | "medium";
};

export const SortSelect: React.FC<SortSelectProps> = ({
  value,
  onChange,
  options = SORT_OPTIONS,
  label,
  size = "small",
}) => {
  return (
    <TextField
      select
      size={size}
      label={label}
      value={value ?? "relevance"}
      onChange={(e) =>
        onChange(e.target.value === "relevance" ? undefined : e.target.value)
      }
      className="min-w-[160px]"
    >
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
};
