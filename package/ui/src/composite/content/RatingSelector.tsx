import type { ContentRating } from "@rezics/contract";
import { Label } from "#/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/shadcn/select";

const RATING_OPTIONS: readonly { value: ContentRating; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "R_15", label: "R-15" },
  { value: "R_18", label: "R-18" },
  { value: "R_18G", label: "R-18G" },
];

export interface RatingSelectorProps {
  value: ContentRating;
  onChange: (next: ContentRating) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "default";
}

export function RatingSelector({
  value,
  onChange,
  label = "Content rating",
  helperText,
  disabled,
  fullWidth = true,
  size = "sm",
}: RatingSelectorProps) {
  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      <Label htmlFor="rating-selector" className="text-sm text-rezics-fg-muted">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ContentRating)}
        disabled={disabled}
      >
        <SelectTrigger
          id="rating-selector"
          size={size}
          className={fullWidth ? "w-full" : undefined}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {RATING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? (
        <p className="text-xs text-rezics-fg-muted">{helperText}</p>
      ) : null}
    </div>
  );
}
