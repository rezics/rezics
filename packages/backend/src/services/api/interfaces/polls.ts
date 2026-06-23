import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas / 响应 schema
// ---------------------------------------------------------------------------

export class PollOptionDTO extends Schema.Class<PollOptionDTO>("PollOptionDTO")({
  pollUnitId: Schema.String,
  optionId: Schema.String,
  position: Schema.String,
  label: Schema.NullOr(Schema.String),
  unitId: Schema.NullOr(Schema.String),
  voteCount: Schema.NullOr(Schema.Number),
}) {}

export class PollVoteContext extends Schema.Class<PollVoteContext>("PollVoteContext")({
  optionId: Schema.String,
  realmUnitId: Schema.NullOr(Schema.String),
}) {}

export class Poll extends Schema.Class<Poll>("Poll")({
  pollUnitId: Schema.String,
  voteMode: Schema.String,
  resultVisibility: Schema.String,
  isAnonymous: Schema.Boolean,
  isClosed: Schema.Boolean,
  closesAt: Schema.NullOr(Schema.String),
  isResultsVisible: Schema.Boolean,
  usageCount: Schema.Number,
  options: Schema.Array(PollOptionDTO),
  totalVotes: Schema.NullOr(Schema.Number),
  myVote: Schema.Array(Schema.String),
  myVoteContexts: Schema.Array(PollVoteContext),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PollNotFound extends Schema.TaggedErrorClass<PollNotFound>()(
  "PollNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class PollForbidden extends Schema.TaggedErrorClass<PollForbidden>()(
  "PollForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /poll — CRUD + voting
// ---------------------------------------------------------------------------

export class PollsGroup extends HttpApiGroup.make("polls")
  .add(
    // POST /poll/ — create poll
    // 创建投票
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        question: Schema.String,
        options: Schema.Array(Schema.String),
        allowMultiple: Schema.optional(Schema.Boolean),
        closesAt: Schema.optional(Schema.String),
      }),
      success: Poll,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // GET /poll/:pollUnitId — get poll with results
    // 获取投票及结果
    HttpApiEndpoint.get("get", "/:pollUnitId", {
      params: { pollUnitId: Schema.String },
      success: Poll,
      error: [PollNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // POST /poll/:pollUnitId/vote — cast vote
    // 投票
    HttpApiEndpoint.post("vote", "/:pollUnitId/vote", {
      params: { pollUnitId: Schema.String },
      payload: Schema.Struct({
        optionIds: Schema.Array(Schema.String),
      }),
      success: Poll,
      error: [PollNotFound, PollForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /poll/:pollUnitId/vote — retract vote
    // 撤回投票
    HttpApiEndpoint.delete("unvote", "/:pollUnitId/vote", {
      params: { pollUnitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [PollNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/poll") {}
