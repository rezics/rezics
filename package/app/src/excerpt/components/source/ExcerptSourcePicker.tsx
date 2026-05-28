import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { ExcerptSource } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { type Candidate, UnitPicker } from "@/unit";

interface ExcerptSourcePickerProps {
  value?: ExcerptSource;
  onChange: (value: ExcerptSource | undefined) => void;
  targetUnitId?: string;
  disabled?: boolean;
  error?: string;
  language?: string;
}

export function ExcerptSourcePicker({
  value,
  onChange,
  targetUnitId,
  disabled,
  error,
  language,
}: ExcerptSourcePickerProps) {
  const { t } = useTranslation(["common", "community"]);
const title = value?.title ?? "";
  const linkedUnitId = value?.mode === "unit" ? value.unitId : undefined;
  const urlValue = value?.mode === "url" ? value.url : "";
  const titlePristineRef = useRef<boolean>(true);

  const { data: linkedUnit } = useQuery({
    ...unitQueries.detail(linkedUnitId ?? ""),
    enabled: !!linkedUnitId,
  });

  const linkedUnitTitle = linkedUnit
    ? (getTranslation(
        linkedUnit.translations,
        language,
        linkedUnit.defaultLanguage ?? undefined,
      )?.title ?? undefined)
    : undefined;

  useEffect(() => {
    if (
      titlePristineRef.current &&
      linkedUnitTitle &&
      value?.mode === "unit" &&
      value.title !== linkedUnitTitle
    ) {
      onChange({ ...value, title: linkedUnitTitle });
    }
  }, [linkedUnitTitle, value, onChange]);

  function handlePickCandidate(candidate: Candidate) {
    titlePristineRef.current = true;
    onChange({
      mode: "unit",
      unitId: candidate.identifier,
      title,
    });
  }

  function handleTitleChange(next: string) {
    titlePristineRef.current = false;
    if (!value) return;
    onChange({ ...value, title: next });
  }

  function handleUrlChange(raw: string) {
    if (raw === "") {
      if (value?.mode === "url") onChange(undefined);
      return;
    }
    onChange({ mode: "url", url: raw, title });
  }

  function handleClear() {
    titlePristineRef.current = true;
    onChange(undefined);
  }

  return (
    <div className="flex flex-col gap-2">
      {value?.mode === "unit" && (
        <div className="flex items-center justify-between gap-2 p-2 rounded border border-border-whisper bg-surface-elevated">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-text-secondary">
              {t("community:excerpt_form_linked_unit")}
            </span>
            <span className="text-sm truncate">
              {linkedUnitTitle ?? linkedUnitId}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleClear}
            disabled={disabled}
          >
            {t("common:clear")}
          </Button>
        </div>
      )}

      <UnitPicker
        workContextUnitId={targetUnitId}
        language={language}
        inputId="excerpt-source-url"
        label={t("community:excerpt_form_source_url")}
        renderItemAction={(candidate) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => handlePickCandidate(candidate)}
          >
            {t("community:excerpt_form_use_this")}
          </Button>
        )}
      />

      <div className="flex flex-col gap-1">
        <Label htmlFor="excerpt-source-raw-url">
          {t("community:excerpt_form_raw_url")}
        </Label>
        <Input
          id="excerpt-source-raw-url"
          value={urlValue}
          disabled={disabled}
          onChange={(e) => handleUrlChange(e.target.value)}
          aria-invalid={!!error}
          className={error ? "border-border-error" : undefined}
        />
        {error ? <p className="text-sm text-error-text">{error}</p> : null}
      </div>

      {value && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="excerpt-source-title">
            {t("community:excerpt_form_source_title")}
          </Label>
          <Input
            id="excerpt-source-title"
            value={title}
            disabled={disabled}
            onChange={(e) => handleTitleChange(e.target.value)}
            maxLength={200}
          />
        </div>
      )}
    </div>
  );
}
