import { Spinner } from "@rezics/ui";
import type { UnitDTO } from "@rezics/contract";
import type { ReactNode } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { Candidate } from "../../models/types";

interface UnitCandidateRowProps {
  candidate: Candidate;
  unit?: UnitDTO;
  isLoading?: boolean;
  language?: string;
  action?: ReactNode;
}

function displayTitle(unit: UnitDTO, language?: string): string | undefined {
  const tr = getTranslation(
    unit.translations,
    language,
    unit.defaultLanguage ?? undefined,
  );
  return tr?.title ?? undefined;
}

export function UnitCandidateRow({
  candidate,
  unit,
  isLoading,
  language,
  action,
}: UnitCandidateRowProps) {
  const title = unit ? displayTitle(unit, language) : undefined;
  return (
    <li className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-surface-subtle">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface-elevated text-text-secondary border border-border-whisper shrink-0">
          {candidate.kind}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm truncate">
            {isLoading ? <Spinner size="sm" /> : (title ?? candidate.identifier)}
          </span>
          <span className="text-xs text-text-secondary truncate">
            {candidate.identifierType === "slug"
              ? `slug: ${candidate.identifier}`
              : `id: ${candidate.identifier}`}
          </span>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}
