import {
  Alert,
  AlertDescription,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseAppRoute } from "@/shared/utils/parse-app-route";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { ChevronDown as ExpandMore } from "lucide-react";

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
  const { t } = useTranslation();
  const urlInputValue = value?.mode === "url" ? value.url : "";
  const linkedUnitId = value?.mode === "unit" ? value.unitId : undefined;
  const title = value?.title ?? "";

  const titlePristineRef = useRef<boolean>(true);
  const [justUpgradedFromUnitId, setJustUpgradedFromUnitId] = useState<
    string | null
  >(null);

  const { data: linkedUnitData } = useQuery({
    ...unitQueries.detail(linkedUnitId ?? ""),
    enabled: !!linkedUnitId,
  });

  const linkedUnitTitle = linkedUnitData
    ? displayTitle(linkedUnitData, language)
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

  function handleUrlChange(raw: string) {
    const parsed = parseAppRoute(raw);
    if (parsed) {
      if (value?.mode !== "unit" || value.unitId !== parsed.unitId) {
        setJustUpgradedFromUnitId(parsed.unitId);
      }
      onChange({ mode: "unit", unitId: parsed.unitId, title });
    } else {
      if (value?.mode === "unit") {
        setJustUpgradedFromUnitId(null);
      }
      if (raw === "") {
        onChange(undefined);
        titlePristineRef.current = true;
        return;
      }
      onChange({ mode: "url", url: raw, title });
    }
  }

  function handleTitleChange(next: string) {
    titlePristineRef.current = false;
    if (!value) {
      return;
    }
    if (value.mode === "unit") {
      onChange({ ...value, title: next });
    } else {
      onChange({ ...value, title: next });
    }
  }

  function handlePickUnit(unit: UnitDTO) {
    if (!unit.id) return;
    titlePristineRef.current = true;
    const prefilled = displayTitle(unit, language) ?? title;
    onChange({ mode: "unit", unitId: unit.id, title: prefilled });
    setJustUpgradedFromUnitId(unit.id);
  }

  const displayedUrl =
    value?.mode === "unit" ? `/unit/${value.unitId}` : urlInputValue;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="excerpt-source-url">
          {t("excerpt.form.source_url", "Source URL")}
        </Label>
        <Input
          id="excerpt-source-url"
          value={displayedUrl}
          disabled={disabled}
          onChange={(e) => handleUrlChange(e.target.value)}
          aria-invalid={!!error}
          className={error ? "border-border-error" : undefined}
        />
        {error ? (
          <p className="text-sm text-error-text">{error}</p>
        ) : null}
      </div>

      {justUpgradedFromUnitId && linkedUnitTitle && (
        <Alert className="py-2">
          <AlertDescription>
            {t("excerpt.form.linked_to", "Linked to: {{title}}", {
              title: linkedUnitTitle,
            })}
          </AlertDescription>
        </Alert>
      )}

      {value && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="excerpt-source-title">
            {t("excerpt.form.source_title", "Source title")}
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

      {targetUnitId && (
        <TreeDisclosure
          targetUnitId={targetUnitId}
          language={language}
          disabled={disabled}
          onPick={handlePickUnit}
        />
      )}
    </div>
  );
}

interface TreeDisclosureProps {
  targetUnitId: string;
  language?: string;
  disabled?: boolean;
  onPick: (unit: UnitDTO) => void;
}

function TreeDisclosure({
  targetUnitId,
  language,
  disabled,
  onPick,
}: TreeDisclosureProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...unitQueries.list({ workUnitId: targetUnitId, limit: 100 }),
    enabled: expanded,
  });

  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <div className="border-t border-border-whisper pt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded((s) => !s)}
        className="flex items-center gap-2 text-sm w-full text-left hover:text-text-brand disabled:opacity-50"
        aria-expanded={expanded}
      >
        <ExpandMore
          className={
            "h-4 w-4 transition-transform " +
            (expanded ? "rotate-180" : "rotate-0")
          }
        />
        <span>
          {t("excerpt.form.pick_from_work", "Pick from this work")}
        </span>
      </button>
      {expanded && (
        <div className="pl-6 pt-2">
          {isLoading && <Spinner size="sm" />}
          {error && (
            <p className="text-xs text-error-text">
              {String(error)}
            </p>
          )}
          {!isLoading && !error && units.length === 0 && (
            <p className="text-xs text-text-secondary">
              {t("excerpt.form.no_sub_units", "No sub-units")}
            </p>
          )}
          <ul className="flex flex-col">
            {units.map((unit) => (
              <li key={unit.id}>
                <button
                  type="button"
                  onClick={() => onPick(unit)}
                  className="w-full text-left text-sm py-1 px-2 rounded hover:bg-surface-subtle"
                >
                  {displayTitle(unit, language) ?? unit.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function displayTitle(unit: UnitDTO, language?: string): string | undefined {
  const t = getTranslation(
    unit.translations,
    language,
    unit.defaultLanguage ?? undefined,
  );
  return t?.title ?? undefined;
}
