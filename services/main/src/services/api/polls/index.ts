import { StatusCodes } from "http-status-codes";
import { createPollContentBlock, parseDocument, PollContentBlock } from "@rezics/block";
import { and, eq, inArray, sql } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { resolvedUnitLocalizationLanguage } from "../../units/localization";
import {
	pollOption,
	poll,
	pollVote,
	unitOwnership,
	unitLocalization,
	unit,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { CreatePollBody, PollDetailQuery, PollParams, VotePollBody } from "./schema";
import { toApiErrorResponse, PollDetailResponse } from "../schema/response";
import { IdResponse, PollVoteResponse } from "../schema/action-response";
import {
	PollAlreadyClosed,
	PollClosed,
	PollNotFound,
	PollOptionInvalid,
	PollOptionsDuplicated,
	PollSingleChoiceInvalid,
} from "./errors";

export default new Elysia({ prefix: "/polls" })
	.use(session)
	.post(
		"",
		async ({ profile, authorization, body }) => {
			const optionKeys = body.options.map((option) =>
				option.sourceKind === "unit"
					? `unit:${option.targetUnitId}`
					: `literal:${option.label.trim().toLowerCase()}`,
			);
			if (new Set(optionKeys).size !== body.options.length) throw new PollOptionsDuplicated();
			const targetUnitIds = [
				...new Set(
					body.options.flatMap((option) =>
						option.sourceKind === "unit" ? [option.targetUnitId] : [],
					),
				),
			];
			await Promise.all(
				targetUnitIds.map((targetUnitId) => authorization.unit.ensureCanRead(targetUnitId)),
			);
			const id = await database.transaction(async (tx) => {
				const pollUnit = await insertUnit(tx, {
					kind: "poll",
					status: "published",
					visibility: "public",
					publishedAt: new Date(),
					statusActor: { kind: "profile", profileId: profile.unitId },
				});
				await tx.insert(poll).values({
					id: pollUnit.id,
					mode: body.voteMode,
					anonymous: body.anonymous,
					resultVisibility: body.resultsVisibility,
					closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
				});
				const options = await tx
					.insert(pollOption)
					.values(
						body.options.map((option, position) => ({
							pollId: pollUnit.id,
							sourceKind: option.sourceKind,
							targetUnitId: option.sourceKind === "unit" ? option.targetUnitId : null,
							position,
						})),
					)
					.returning({ id: pollOption.id, position: pollOption.position });
				await tx.insert(unitLocalization).values({
					unitId: pollUnit.id,
					language: body.language,
					title: body.question,
					content: createPollContentBlock(
						options.map((option) => {
							const input = body.options[option.position];
							if (!input) throw new TypeError("Poll option position has no input");
							return { optionId: option.id, label: input.label };
						}),
					),
					contentStatus: "published",
				});
				await tx.insert(unitOwnership).values({
					unitId: pollUnit.id,
					profileId: profile.unitId,
					assignedByProfileId: profile.unitId,
				});
				await recordUnitRevision(tx, {
					unitId: pollUnit.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				return pollUnit.id;
			});
			return { id };
		},
		{
			access: "contribute:unit:create",
			body: CreatePollBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["PollOptionsDuplicated"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Create poll", tags: ["Polls"] },
		},
	)
	.get(
		"/:pollId",
		async ({ params, query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const [pollRecord] = await database
				.select({
					id: poll.id,
					language: unitLocalization.language,
					question: unitLocalization.title,
					content: unitLocalization.content,
					voteMode: poll.mode,
					anonymous: poll.anonymous,
					resultsVisibility: poll.resultVisibility,
					closesAt: poll.closesAt,
					closedAt: poll.closedAt,
					createdAt: unit.createdAt,
				})
				.from(poll)
				.innerJoin(unit, eq(unit.id, poll.id))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, poll.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(poll.id, localizationLanguages),
						),
					),
				)
				.where(eq(poll.id, params.pollId))
				.limit(1);
			if (!pollRecord) throw new PollNotFound();
			const content = parseDocument(PollContentBlock, pollRecord.content);
			const labelByOptionId = new Map(
				content.options.map((option) => [option.optionId, option.label]),
			);
			const { profile: viewer, authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.pollId, () => new UnitNotFound("Poll"));
			const viewerVotes = viewer
				? await database
						.select({ optionId: pollVote.optionId })
						.from(pollVote)
						.where(
							and(
								eq(pollVote.pollId, params.pollId),
								eq(pollVote.profileId, viewer.unitId),
							),
						)
				: [];
			const closed = Boolean(
				pollRecord.closedAt || (pollRecord.closesAt && pollRecord.closesAt <= new Date()),
			);
			const showResults =
				pollRecord.resultsVisibility === "live" ||
				(pollRecord.resultsVisibility === "after_close" && closed);
			const { content: _content, ...presentedPoll } = pollRecord;
			const options = await database
				.select({
					id: pollOption.id,
					sourceKind: pollOption.sourceKind,
					targetUnitId: pollOption.targetUnitId,
					position: pollOption.position,
					voteCount: sql<number>`(select count(*) from ${pollVote} where ${pollVote.optionId} = ${pollOption.id})::int`,
				})
				.from(pollOption)
				.where(eq(pollOption.pollId, params.pollId))
				.orderBy(pollOption.position);
			return {
				...presentedPoll,
				question: pollRecord.question ?? "",
				voteMode: pollRecord.voteMode,
				resultsVisibility: pollRecord.resultsVisibility,
				closed,
				viewerOptionIds: viewerVotes.map((vote) => vote.optionId),
				options: options.map((option) => {
					const { sourceKind, targetUnitId, ...fields } = option;
					const presentation = {
						...fields,
						label: labelByOptionId.get(option.id) ?? "",
						voteCount: showResults ? option.voteCount : null,
					};
					if (sourceKind === "literal") {
						if (targetUnitId !== null)
							throw new TypeError("Literal Poll option has a target Unit");
						return { ...presentation, sourceKind, targetUnitId };
					}
					if (targetUnitId === null)
						throw new TypeError("Unit-backed Poll option has no target Unit");
					return { ...presentation, sourceKind, targetUnitId };
				}),
			};
		},
		{
			params: PollParams,
			query: PollDetailQuery,
			response: {
				[StatusCodes.OK]: PollDetailResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PollNotFound", "UnitNotFound"]),
			},
			detail: { summary: "Get poll", tags: ["Polls"] },
		},
	)
	.put(
		"/:pollId/vote",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanRead(params.pollId, () => new UnitNotFound("Poll"));
			await authorization.realm.ensureParticipation(body.realmId);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`poll:${params.pollId}`}::text, 0))`,
				);
				const [pollRecord] = await tx
					.select()
					.from(poll)
					.where(eq(poll.id, params.pollId))
					.limit(1);
				if (!pollRecord) throw new PollNotFound();
				if (
					pollRecord.closedAt ||
					(pollRecord.closesAt && pollRecord.closesAt <= new Date())
				)
					throw new PollClosed();
				if (pollRecord.mode === "single" && body.optionIds.length !== 1)
					throw new PollSingleChoiceInvalid();
				const valid = await tx
					.select({ id: pollOption.id })
					.from(pollOption)
					.where(
						and(
							eq(pollOption.pollId, params.pollId),
							inArray(pollOption.id, body.optionIds),
						),
					);
				if (valid.length !== new Set(body.optionIds).size) throw new PollOptionInvalid();
				await tx
					.delete(pollVote)
					.where(
						and(
							eq(pollVote.pollId, params.pollId),
							eq(pollVote.profileId, profile.unitId),
						),
					);
				await tx.insert(pollVote).values(
					body.optionIds.map((optionId) => ({
						pollId: params.pollId,
						optionId,
						profileId: profile.unitId,
						realmId: body.realmId,
					})),
				);
			});
			return { optionIds: body.optionIds };
		},
		{
			access: "contribute:unit:update",
			params: PollParams,
			body: VotePollBody,
			response: {
				[StatusCodes.OK]: PollVoteResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"PollSingleChoiceInvalid",
					"PollOptionInvalid",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"PollClosed",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "PollNotFound"]),
			},
			detail: { summary: "Replace poll vote", tags: ["Polls"] },
		},
	)
	.delete(
		"/:pollId/vote",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanRead(params.pollId, () => new UnitNotFound("Poll"));
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`poll:${params.pollId}`}::text, 0))`,
				);
				const [pollRecord] = await tx
					.select({ closedAt: poll.closedAt, closesAt: poll.closesAt })
					.from(poll)
					.where(eq(poll.id, params.pollId))
					.limit(1);
				if (!pollRecord) throw new PollNotFound();
				if (
					pollRecord.closedAt ||
					(pollRecord.closesAt && pollRecord.closesAt <= new Date())
				)
					throw new PollClosed();
				await tx
					.delete(pollVote)
					.where(
						and(
							eq(pollVote.pollId, params.pollId),
							eq(pollVote.profileId, profile.unitId),
						),
					);
			});
			return { optionIds: [] };
		},
		{
			access: "write:interaction:write",
			params: PollParams,
			response: {
				[StatusCodes.OK]: PollVoteResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PollClosed"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "PollNotFound"]),
			},
			detail: { summary: "Withdraw poll vote", tags: ["Polls"] },
		},
	)
	.post(
		"/:pollId/close",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.pollId, [["poll", "closed-at"]]);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`poll:${params.pollId}`}::text, 0))`,
				);
				const [updated] = await tx
					.update(poll)
					.set({ closedAt: new Date() })
					.where(and(eq(poll.id, params.pollId), sql`${poll.closedAt} is null`))
					.returning({ id: poll.id });
				if (!updated) throw new PollAlreadyClosed();
				await recordUnitRevision(tx, {
					unitId: params.pollId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { id: params.pollId };
		},
		{
			access: "write:interaction:write",
			params: PollParams,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["PollAlreadyClosed"]),
			},
			detail: { summary: "Close poll", tags: ["Polls"] },
		},
	);
