import type {
  PollOptionDTO,
  PollResultsDTO,
  PollVoteMode,
} from "@rezics/contract";

/**
 * React-free render model for the poll display.
 *
 * `selectPollView` maps a gated {@link PollResultsDTO} to a flat render state.
 * It NEVER recomputes or infers tallies, visibility, or the caller's vote — it
 * only reshapes what the contract exposes, so the full conditional matrix
 * (SINGLE/MULTI × visible/withheld × open/closed × named/anonymous ×
 * label/unit/tombstone) is exercised without React in `pollView.test.ts`.
 */

/** How an option presents: ad-hoc text, a referenced unit, or a tombstone. */
export type PollOptionForm = "text" | "unit" | "tombstone";

export interface PollOptionView {
  optionId: string;
  form: PollOptionForm;
  /** Present only when `form === "text"`. */
  label: string | null;
  /** Present only when `form === "unit"`. */
  unitId: string | null;
  /** Whether the calling user has voted for this option (`myVote`). */
  selected: boolean;
  /** Tally for this option; omitted (undefined) when counts are withheld. */
  voteCount: number | undefined;
  /**
   * Proportion of `totalVotes` as a 0–100 percentage for the result bar.
   * `0` when counts are withheld or `totalVotes` is zero/absent.
   */
  percent: number;
}

export interface PollView {
  pollUnitId: string;
  voteMode: PollVoteMode;
  /** True when the contract exposes tallies (`resultsVisible`). */
  countsVisible: boolean;
  /** True when the caller may cast/withdraw a vote (poll is not closed). */
  votingEnabled: boolean;
  /** Presentation-only flag; the contract already withholds voter↔option maps. */
  anonymous: boolean;
  closed: boolean;
  /**
   * True for an `AFTER_CLOSE` poll whose tallies are withheld until it closes,
   * so the display can explain why no counts are shown while voting stays open.
   */
  resultsHiddenUntilClose: boolean;
  /** Sum of votes for bar proportions; undefined when counts are withheld. */
  totalVotes: number | undefined;
  options: PollOptionView[];
}

function optionForm(option: PollOptionDTO): PollOptionForm {
  if (typeof option.label === "string") return "text";
  if (typeof option.unitId === "string") return "unit";
  return "tombstone";
}

function byPosition(a: PollOptionDTO, b: PollOptionDTO): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}

export function selectPollView(results: PollResultsDTO): PollView {
  const countsVisible = results.resultsVisible;
  const myVote = new Set(results.myVote);
  const totalVotes = countsVisible ? results.totalVotes : undefined;

  const options: PollOptionView[] = [...results.options]
    .sort(byPosition)
    .map((option) => {
      const form = optionForm(option);
      const voteCount = countsVisible ? (option.voteCount ?? 0) : undefined;
      const percent =
        countsVisible && totalVotes && totalVotes > 0 && voteCount !== undefined
          ? (voteCount / totalVotes) * 100
          : 0;
      return {
        optionId: option.optionId,
        form,
        label: form === "text" ? (option.label ?? null) : null,
        unitId: form === "unit" ? (option.unitId ?? null) : null,
        selected: myVote.has(option.optionId),
        voteCount,
        percent,
      };
    });

  return {
    pollUnitId: results.pollUnitId,
    voteMode: results.voteMode,
    countsVisible,
    votingEnabled: !results.closed,
    anonymous: results.anonymous,
    closed: results.closed,
    resultsHiddenUntilClose:
      results.resultVisibility === "AFTER_CLOSE" && !results.resultsVisible,
    totalVotes,
    options,
  };
}
