import type { UnitDTO } from "@rezics/contract";
import type { ReactNode } from "react";
import type { Candidate } from "../../models/types";
import { candidateToUnitCardSummary } from "../../models/unitCardSummary";
import { UnitCard } from "../UnitCard";
import { useMessage } from "@rezics/i18n/react";
import { common_loading } from "@rezics/i18n/messages";
const i18nMessages = {
  common_loading,
};

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
  const m = useMessage(i18nMessages);
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
