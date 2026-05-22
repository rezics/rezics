import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { UnitDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { useUnitCandidates } from "../../hooks/useUnitCandidates";
import type { Candidate } from "../../models/types";
import { UnitCandidateRow } from "./UnitCandidateRow";

export interface UnitPickerProps {
  workContextUnitId?: string;
  language?: string;
  initialInput?: string;
  renderItemAction: (candidate: Candidate) => ReactNode;
  inputId?: string;
  label?: string;
  placeholder?: string;
}

export function UnitPicker({
  workContextUnitId,
  language,
  initialInput,
  renderItemAction,
  inputId,
  label,
  placeholder,
}: UnitPickerProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialInput ?? "");
  const { resolved, parseError } = useUnitCandidates(input);

  const fieldId = inputId ?? "unit-picker-input";

  return (
    <div className="flex flex-col gap-2 border-b border-border-whisper pb-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId}>
          {label ?? t("unit_picker.url_label", "Unit URL")}
        </Label>
        <Input
          id={fieldId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            placeholder ??
            t(
              "unit_picker.url_placeholder",
              "Paste a unit, chapter, or book URL",
            )
          }
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
          {t(
            "unit_picker.parse_error",
            "Couldn't recognize that as a unit link.",
          )}
        </p>
      )}

      {workContextUnitId && (
        <BrowsePanel
          workContextUnitId={workContextUnitId}
          language={language}
          renderItemAction={renderItemAction}
        />
      )}
    </div>
  );
}

interface BrowsePanelProps {
  workContextUnitId: string;
  language?: string;
  renderItemAction: (candidate: Candidate) => ReactNode;
}

function BrowsePanel({
  workContextUnitId,
  language,
  renderItemAction,
}: BrowsePanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...unitQueries.list({ workUnitId: workContextUnitId, limit: 100 }),
    enabled: expanded,
  });

  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <div className="border-t border-border-whisper pt-2">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="flex items-center gap-2 text-sm w-full text-left hover:text-text-brand"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={
            "h-4 w-4 transition-transform " +
            (expanded ? "rotate-180" : "rotate-0")
          }
        />
        <span>{t("unit_picker.browse_panel", "Browse this work")}</span>
      </button>
      {expanded && (
        <div className="pt-2">
          {isLoading && <Spinner size="sm" />}
          {error && <p className="text-xs text-error-text">{String(error)}</p>}
          {!isLoading && !error && units.length === 0 && (
            <p className="text-xs text-text-secondary">
              {t("unit_picker.no_sub_units", "No sub-units")}
            </p>
          )}
          <ul className="flex flex-col">
            {units.map((unit) => {
              if (!unit.id) return null;
              const candidate: Candidate = {
                kind: "unit",
                identifier: unit.id,
                identifierType: "id",
                paramName: "unitId",
              };
              return (
                <UnitCandidateRow
                  key={unit.id}
                  candidate={candidate}
                  unit={unit}
                  language={language}
                  action={renderItemAction(candidate)}
                />
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
