import type { AiDisclosureMode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  label,
  labels,
  helperText,
  disabled,
  fullWidth = true,
  size = "sm",
}: AiDisclosureSelectorProps) {
  const { t } = useTranslation("book");
  const effectiveLabel = label ?? t("fields_ai_disclosure");

  const aiDisclosureLabels: Record<AiDisclosureMode, string> = {
    UNKNOWN: t("ai_disclosure_unknown"),
    NONE: t("ai_disclosure_none"),
    AI_ASSISTED: t("ai_disclosure_assisted"),
    AI_ORIGINATED: t("ai_disclosure_originated"),
    MACHINE_GENERATED: t("ai_disclosure_machine_generated"),
  };

  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      <Label
        htmlFor="ai-disclosure-selector"
        className="text-sm text-rezics-fg-muted"
      >
        {effectiveLabel}
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
          <SelectValue placeholder={effectiveLabel} />
        </SelectTrigger>
        <SelectContent>
          {AI_DISCLOSURE_OPTIONS.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {labels?.[mode] ?? aiDisclosureLabels[mode]}
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
