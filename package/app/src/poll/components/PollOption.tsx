import { unitDetailQuery } from "@rezics/api/unit/unit";
import type { PollVoteMode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { UnitCard, unitDtoToUnitCardSummary } from "@/unit";
import type { PollOptionView } from "../models/pollView";

interface PollOptionProps {
  option: PollOptionView;
  voteMode: PollVoteMode;
  /** Whether the caller may cast/withdraw (false on a closed poll). */
  votingEnabled: boolean;
  /** Whether tallies are exposed (drives the count + bar). */
  countsVisible: boolean;
  /** A vote/withdraw mutation is in flight. */
  pending: boolean;
  onSelect: (optionId: string) => void;
}

/** Renders a referenced unit (the option's `unitId`) via the shared unit card. */
function PollUnitOption({ unitId }: { unitId: string }) {
  const { t } = useTranslation(["common"]);
  const { data: unit, isLoading } = useQuery(unitDetailQuery(unitId));

  if (isLoading) {
    return (
      <span className="text-sm leading-ui text-text-secondary">
        {t("common:loading")}
      </span>
    );
  }
  if (!unit) {
    return (
      <span className="text-sm leading-ui text-text-tertiary">{unitId}</span>
    );
  }
  return (
    <UnitCard summary={unitDtoToUnitCardSummary(unit)} variant="compact" />
  );
}

export const PollOption: React.FC<PollOptionProps> = ({
  option,
  voteMode,
  votingEnabled,
  countsVisible,
  pending,
  onSelect,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const { selected, percent, voteCount, form } = option;

  const content =
    form === "unit" && option.unitId ? (
      <PollUnitOption unitId={option.unitId} />
    ) : form === "tombstone" ? (
      <span className="text-sm italic leading-ui text-text-tertiary">
        {t("community:poll_option_tombstone")}
      </span>
    ) : (
      <span className="text-sm leading-ui text-text-primary">
        {option.label}
      </span>
    );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant={selected ? "default" : "outline"}
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0",
            voteMode === "SINGLE" ? "rounded-full" : "rounded-sm",
          )}
          disabled={!votingEnabled || pending}
          aria-pressed={selected}
          aria-label={t("community:poll_vote")}
          onClick={() => onSelect(option.optionId)}
        >
          {selected ? <Check className="h-4 w-4" /> : null}
        </Button>

        <div className="min-w-0 flex-1">{content}</div>

        {countsVisible && voteCount !== undefined && (
          <span className="shrink-0 text-sm tabular-nums leading-ui text-text-secondary">
            {voteCount}
          </span>
        )}
      </div>

      {countsVisible && voteCount !== undefined && (
        <div
          className="ml-10 h-1.5 overflow-hidden rounded-full"
          style={{
            backgroundColor: "var(--colors-surface-subtle, rgba(0,0,0,0.06))",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: selected
                ? "var(--colors-brand-fill)"
                : "var(--colors-border-strong)",
            }}
          />
        </div>
      )}
    </div>
  );
};
