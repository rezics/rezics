import { TextField } from "@mui/material";
import type { SearchQuery } from "@rezics/contract";
import type React from "react";

type TextLength = NonNullable<SearchQuery["textLength"]>;

export type WordCountRangeInputProps = {
  value: TextLength | undefined;
  onChange: (value: TextLength | undefined) => void;
  label?: string;
  size?: "small" | "medium";
};

function parse(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function merge(
  prev: TextLength | undefined,
  key: "min" | "max",
  next: number | undefined,
): TextLength | undefined {
  const current = prev ?? {};
  const merged: TextLength = { ...current, [key]: next };
  if (merged.min === undefined) delete merged.min;
  if (merged.max === undefined) delete merged.max;
  if (merged.min === undefined && merged.max === undefined) return undefined;
  return merged;
}

export const WordCountRangeInput: React.FC<WordCountRangeInputProps> = ({
  value,
  onChange,
  label,
  size = "small",
}) => {
  const min = value?.min;
  const max = value?.max;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium opacity-60">{label}</span>
      )}
      <div className="flex items-center gap-2">
        <TextField
          size={size}
          type="number"
          placeholder="min"
          value={min ?? ""}
          className="w-24"
          onChange={(e) => onChange(merge(value, "min", parse(e.target.value)))}
          slotProps={{ htmlInput: { min: 0 } }}
        />
        <span className="opacity-60">—</span>
        <TextField
          size={size}
          type="number"
          placeholder="max"
          value={max ?? ""}
          className="w-24"
          onChange={(e) => onChange(merge(value, "max", parse(e.target.value)))}
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </div>
    </div>
  );
};
