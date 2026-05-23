import type { UnitDTO } from "@rezics/contract";
import type { ReactNode } from "react";
import * as m from "@rezics/i18n/messages";
import { UnitCard } from "../UnitCard";
import { candidateToUnitCardSummary } from "../../models/unitCardSummary";
import type { Candidate } from "../../models/types";

interface UnitCandidateRowProps {
  candidate: Candidate;
  unit?: UnitDTO;
  isLoading?: boolean;
  language?: string;
  action?: ReactNode;
  onPreview?: (candidate: Candidate, unit?: UnitDTO) => void;
}

export function UnitCandidateRow({
  candidate,
  unit,
  isLoading,
  language,
  action,
  onPreview,
}: UnitCandidateRowProps) {
  const summary = candidateToUnitCardSummary(candidate, unit, {
    language,
    fallbackTitle: isLoading ? m.common_loading() : candidate.identifier,
  });
  return (
    <li
      className="list-none py-1"
      onMouseEnter={() => onPreview?.(candidate, unit)}
      onFocus={() => onPreview?.(candidate, unit)}
    >
      <UnitCard summary={summary} variant="compact" action={action} />
    </li>
  );
}
