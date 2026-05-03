import { Input, Label } from "@rezics/ui/shadcn";
import type { SearchQuery } from "@rezics/contract";
import type React from "react";
import { useEffect, useState } from "react";

type TextLength = NonNullable<SearchQuery["textLength"]>;

export type WordCountRangeInputProps = {
  value: TextLength | undefined;
  onChange: (value: TextLength | undefined) => void;
  label?: string;
  size?: "small" | "medium";
  placeholder?: string;
};

const SEPARATOR = /\s*[-–~]\s*/;

function format(value: TextLength | undefined): string {
  if (!value) return "";
  const { min, max } = value;
  if (min !== undefined && max !== undefined) return `${min}-${max}`;
  if (min !== undefined) return `${min}-`;
  if (max !== undefined) return `-${max}`;
  return "";
}

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parse(raw: string): TextLength | undefined | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;

  if (SEPARATOR.test(trimmed)) {
    const [left, right] = trimmed.split(SEPARATOR);
    const min = parseNumber(left ?? "");
    const max = parseNumber(right ?? "");
    if (left && left.trim() !== "" && min === undefined) return "invalid";
    if (right && right.trim() !== "" && max === undefined) return "invalid";
    if (min === undefined && max === undefined) return undefined;
    if (min !== undefined && max !== undefined && min > max) return "invalid";
    const out: TextLength = {};
    if (min !== undefined) out.min = min;
    if (max !== undefined) out.max = max;
    return out;
  }

  const single = parseNumber(trimmed);
  if (single === undefined) return "invalid";
  return { min: single };
}

export const WordCountRangeInput: React.FC<WordCountRangeInputProps> = ({
  value,
  onChange,
  label,
  placeholder = "min-max",
}) => {
  const [local, setLocal] = useState<string>(() => format(value));

  useEffect(() => {
    setLocal(format(value));
  }, [value]);

  const commit = () => {
    const result = parse(local);
    if (result === "invalid") {
      setLocal(format(value));
      return;
    }
    onChange(result);
    setLocal(format(result));
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <Label>{label}</Label>}
      <Input
        placeholder={placeholder}
        value={local}
        className="w-40"
        inputMode="numeric"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
};
