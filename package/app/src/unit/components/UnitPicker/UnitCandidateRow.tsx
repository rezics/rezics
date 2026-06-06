import type { UnitDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type { ReactNode } from "react";
import type { Candidate } from "../../models/types";
import { candidateToUnitCardSummary } from "../../models/unitCardSummary";
import { UnitCard } from "../UnitCard";

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
  const { t } = useTranslation(["common"]);
  const summary = candidateToUnitCardSummary(candidate, unit, {
    language,
    fallbackTitle: isLoading ? t("common:loading") : candidate.identifier,
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
