import type {
  PollOptionDTO,
  PollResultsDTO,
  PollVoteMode,
} from "@rezics/contract";

/**
 * React-free render model for the poll display.
 * 投票展示的无 React 渲染模型。
 *
 * `selectPollView` maps a gated {@link PollResultsDTO} to a flat render state.
 * It NEVER recomputes or infers tallies, visibility, or the caller's vote — it
 * only reshapes what the contract exposes, so the full conditional matrix
 * (SINGLE/MULTI × visible/withheld × open/closed × named/anonymous ×
 * label/unit/tombstone) is exercised without React in `pollView.test.ts`.
 * `selectPollView` 将受控的 {@link PollResultsDTO} 映射为扁平的渲染状态。它
 * 绝不重新计算或推断票数、可见性或调用者的投票——只重塑契约暴露的内容，
 * 因此完整的条件矩阵（SINGLE/MULTI × 可见/隐藏 × 开放/关闭 × 实名/匿名 ×
 * label/unit/tombstone）可在 `pollView.test.ts` 中不依赖 React 地被覆盖。
 */

/**
 * How an option presents: ad-hoc text, a referenced unit, or a tombstone.
 * 选项的呈现形式：临时文本、被引用的 unit，或 tombstone。
 */
export type PollOptionForm = "text" | "unit" | "tombstone";

export interface PollOptionView {
  optionId: string;
  form: PollOptionForm;
  /**
   * Present only when `form === "text"`.
   * 仅当 `form === "text"` 时存在。
   */
  label: string | null;
  /**
   * Present only when `form === "unit"`.
   * 仅当 `form === "unit"` 时存在。
   */
  unitId: string | null;
  /**
   * Whether the calling user has voted for this option (`myVote`).
   * 调用用户是否已为该选项投票（`myVote`）。
   */
  selected: boolean;
  /**
   * Tally for this option; omitted (undefined) when counts are withheld.
   * 该选项的票数；当票数被隐藏时省略（undefined）。
   */
  voteCount: number | undefined;
  /**
   * Proportion of `totalVotes` as a 0–100 percentage for the result bar.
   * `0` when counts are withheld or `totalVotes` is zero/absent.
   * 占 `totalVotes` 的比例，作为结果条的 0–100 百分比。
   * 当票数被隐藏或 `totalVotes` 为零/缺失时为 `0`。
   */
  percent: number;
}

export interface PollView {
  pollUnitId: string;
  voteMode: PollVoteMode;
  /**
   * True when the contract exposes tallies (`resultsVisible`).
   * 当契约暴露票数（`resultsVisible`）时为 true。
   */
  countsVisible: boolean;
  /**
   * True when the caller may cast/withdraw a vote (poll is not closed).
   * 当调用者可投票/撤回投票（投票未关闭）时为 true。
   */
  votingEnabled: boolean;
  /**
   * True when the caller already has a vote in a different direct/realm
   * context. The first pass keeps vote identity global, so the UI blocks a
   * second context until the existing vote is withdrawn.
   * 当调用者已在另一个 direct/realm 上下文中投过票时为 true。第一版将投票
   * 身份保持为全局，因此在撤回已有投票前 UI 会阻止第二个上下文投票。
   */
  voteBlockedByContext: boolean;
  /**
   * Presentation-only flag; the contract already withholds voter↔option maps.
   * 仅用于展示的标志；契约本身已隐藏 voter↔option 映射。
   */
  anonymous: boolean;
  closed: boolean;
  /**
   * True for an `AFTER_CLOSE` poll whose tallies are withheld until it closes,
   * so the display can explain why no counts are shown while voting stays open.
   * 对于票数在关闭前一直隐藏的 `AFTER_CLOSE` 投票为 true，以便展示层在投票
   * 仍开放时说明为何不显示票数。
   */
  resultsHiddenUntilClose: boolean;
  /**
   * Sum of votes for bar proportions; undefined when counts are withheld.
   * 用于计算结果条比例的票数总和；当票数被隐藏时为 undefined。
   */
  totalVotes: number | undefined;
  options: PollOptionView[];
}

export interface SelectPollViewOptions {
  currentRealmUnitId?: string | null;
}

function optionForm(option: PollOptionDTO): PollOptionForm {
  if (typeof option.label === "string") return "text";
  if (typeof option.unitId === "string") return "unit";
  return "tombstone";
}

function byPosition(a: PollOptionDTO, b: PollOptionDTO): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}

function isVoteBlockedByContext(
  results: PollResultsDTO,
  currentRealmUnitId: string | null,
): boolean {
  return (results.myVoteContexts ?? []).some(
    (context) => (context.realmUnitId ?? null) !== currentRealmUnitId,
  );
}

export function selectPollView(
  results: PollResultsDTO,
  selectOptions: SelectPollViewOptions = {},
): PollView {
  const countsVisible = results.resultsVisible;
  const myVote = new Set(results.myVote);
  const totalVotes = countsVisible ? results.totalVotes : undefined;
  const currentRealmUnitId = selectOptions.currentRealmUnitId ?? null;
  const voteBlockedByContext = isVoteBlockedByContext(
    results,
    currentRealmUnitId,
  );

  const optionViews: PollOptionView[] = [...results.options]
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
    votingEnabled: !results.closed && !voteBlockedByContext,
    voteBlockedByContext,
    anonymous: results.anonymous,
    closed: results.closed,
    resultsHiddenUntilClose:
      results.resultVisibility === "AFTER_CLOSE" && !results.resultsVisible,
    totalVotes,
    options: optionViews,
  };
}
