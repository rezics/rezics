import { useTranslation } from "@rezics/i18n/react";
import { Input, Label } from "@rezics/ui/shadcn";
import { type ReactNode, useState } from "react";
import { useUnitCandidates } from "../../hooks/useUnitCandidates";
import type { Candidate } from "../../models/types";
import { UnitCandidateRow } from "./UnitCandidateRow";

export interface UnitPickerProps {
  language?: string;
  initialInput?: string;
  renderItemAction: (candidate: Candidate) => ReactNode;
  inputId?: string;
  label?: string;
  placeholder?: string;
}

export function UnitPicker({
  language,
  initialInput,
  renderItemAction,
  inputId,
  label,
  placeholder,
}: UnitPickerProps) {
  const { t } = useTranslation(["book"]);
  const [input, setInput] = useState(initialInput ?? "");
  const { resolved, parseError } = useUnitCandidates(input);

  const fieldId = inputId ?? "unit-picker-input";

  return (
    <div className="flex flex-col gap-2 border-b border-border-whisper pb-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId}>
          {label ?? t("book:unit_picker_url_label")}
        </Label>
        <Input
          id={fieldId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? t("book:unit_picker_url_placeholder")}
        />
      </div>

      {resolved.length > 0 && (
        <ul className="flex flex-col">
          {resolved.map((r) => (
            <UnitCandidateRow
              key={`${r.candidate.paramName}:${r.candidate.identifier}`}
              candidate={r.candidate}
              unit={r.unit}
              isLoading={r.isLoading}
              language={language}
              action={renderItemAction(r.candidate)}
            />
          ))}
        </ul>
      )}

      {parseError && (
        <p className="text-xs text-text-secondary">
          {t("book:unit_picker_parse_error")}
        </p>
      )}
    </div>
  );
}
