import type { PollResultsDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Lock } from "lucide-react";
import type React from "react";
import { usePollVote } from "../hooks/usePollVote";
import { selectPollView } from "../models/pollView";
import { PollOption } from "./PollOption";

interface PollViewProps {
  results: PollResultsDTO;
}

/**
 * The single poll display + voting surface, reused by the standalone page and
 * the in-thread embed. All branching lives in {@link selectPollView}; this
 * component renders the resulting state and defers vote semantics to
 * {@link usePollVote}. It never re-derives tallies, visibility, or the caller's
 * own vote — it shows only what the contract exposes.
 */
export const PollView: React.FC<PollViewProps> = ({ results }) => {
  const { t } = useTranslation(["common", "community"]);
  const view = selectPollView(results);
  const vote = usePollVote({
    pollUnitId: view.pollUnitId,
    voteMode: view.voteMode,
    myVote: results.myVote,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-dense text-text-secondary">
        <span>
          {view.voteMode === "SINGLE"
            ? t("community:poll_vote_mode_single")
            : t("community:poll_vote_mode_multi")}
        </span>
        {view.anonymous && (
          <>
            <span aria-hidden="true">·</span>
            <span>{t("community:poll_anonymous_note")}</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {view.options.map((option) => (
          <PollOption
            key={option.optionId}
            option={option}
            voteMode={view.voteMode}
            votingEnabled={view.votingEnabled}
            countsVisible={view.countsVisible}
            pending={vote.isPending}
            onSelect={vote.select}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1 text-sm leading-ui text-text-secondary">
        {view.resultsHiddenUntilClose && (
          <p>{t("community:poll_results_hidden")}</p>
        )}
        {view.closed && (
          <p className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {t("community:poll_closed")}
          </p>
        )}
        {view.countsVisible && view.totalVotes !== undefined && (
          <p>{t("community:poll_total_votes", { count: view.totalVotes })}</p>
        )}
        {vote.error && (
          <p className="text-error-text">{t("community:poll_vote_error")}</p>
        )}
      </div>
    </div>
  );
};
