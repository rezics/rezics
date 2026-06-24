/**
 * Poll Voting domain.
 *
 * A poll is a `Unit(type=POLL)` with lightweight `PollOption` rows and per-user
 * `PollVote` rows — the third instance of the scored-junction + per-user-vote
 * pattern. Single-choice exclusivity is enforced at the database layer; tallies
 * are denormalized on `PollOption.voteCount`.
 */

export { pollApi } from "./poll.api";
export {
  isPollClosed,
  mapPollOptionToDTO,
  mapPollResultsToDTO,
  mapPollToDTO,
} from "./poll.mapper";
export { PollError, PollService, pollService } from "./poll.service";
export type { PollWithOptions } from "./poll.types";
