import type { AiDisclosureMode } from "@rezics/contract";
import { Label } from "#/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/shadcn/select";

const AI_DISCLOSURE_OPTIONS: readonly AiDisclosureMode[] = [
  "UNKNOWN",
  "NONE",
  "AI_ASSISTED",
  "AI_ORIGINATED",
  "MACHINE_GENERATED",
];

const DEFAULT_AI_DISCLOSURE_LABELS: Record<AiDisclosureMode, string> = {
  UNKNOWN: "Unknown",
  NONE: "No AI use",
  AI_ASSISTED: "AI-assisted",
  AI_ORIGINATED: "AI-originated",
  MACHINE_GENERATED: "Machine-generated",
};

export interface AiDisclosureSelectorProps {
  value: AiDisclosureMode;
  onChange: (next: AiDisclosureMode) => void;
  label?: string;
  labels?: Partial<Record<AiDisclosureMode, string>>;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "default";
}

export function AiDisclosureSelector({
  value,
  onChange,
  label = "AI disclosure",
  labels,
  helperText,
  disabled,
  fullWidth = true,
  size = "sm",
}: AiDisclosureSelectorProps) {
  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      <Label
        htmlFor="ai-disclosure-selector"
        className="text-sm text-rezics-fg-muted"
      >
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as AiDisclosureMode)}
        disabled={disabled}
      >
        <SelectTrigger
          id="ai-disclosure-selector"
          size={size}
          className={fullWidth ? "w-full" : undefined}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {AI_DISCLOSURE_OPTIONS.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {labels?.[mode] ?? DEFAULT_AI_DISCLOSURE_LABELS[mode]}
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
