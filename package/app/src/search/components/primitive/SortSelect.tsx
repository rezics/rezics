import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";

export const SORT_OPTIONS = [
  { value: "relevance", label: i18nMessages.search_sort_relevance },
  { value: "createdAt", label: i18nMessages.search_sort_newest },
  { value: "updatedAt", label: i18nMessages.search_sort_recently_updated },
  { value: "publishedAt", label: i18nMessages.search_sort_publication_date },
] as const satisfies ReadonlyArray<{ value: string; label: () => string }>;

export type SortOption = (typeof SORT_OPTIONS)[number];

export type SortSelectProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options?: readonly { value: string; label: () => string }[];
  label?: string;
  size?: "small" | "medium";
};

export const SortSelect: React.FC<SortSelectProps> = ({
  value,
  onChange,
  options = SORT_OPTIONS,
  label,
}) => {
  const handleChange = (next: string) => {
    onChange(next === "relevance" ? undefined : next);
  };
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      {label && <Label>{label}</Label>}
      <Select value={value ?? "relevance"} onValueChange={handleChange}>
        <SelectTrigger className="min-w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
