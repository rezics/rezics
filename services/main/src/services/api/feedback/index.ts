import { StatusCodes } from "http-status-codes";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import { feedback, moderationCase, realmContent } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { FeedbackRealmMismatch } from "./errors";
import {
	CreateFeedbackBody,
	FeedbackListResponse,
	FeedbackResponse,
	ListFeedbackQuery,
} from "./schema";
import { toApiErrorResponse } from "../schema/response";

const feedbackSelection = {
	id: feedback.id,
	type: feedback.kind,
	content: feedback.content,
	url: feedback.url,
	subjectUnitId: feedback.subjectUnitId,
	status: sql<string>`case when ${feedback.resolvedAt} is null then 'open' else 'resolved' end`,
	resolution: feedback.resolution,
	createdAt: feedback.createdAt,
	updatedAt: feedback.updatedAt,
};

export default new Elysia({ prefix: "/feedback" })
	.use(session)
	.get(
		"/me",
		async ({ profile, query }) => ({
			items: await database
				.select(feedbackSelection)
				.from(feedback)
				.where(eq(feedback.profileId, profile.unitId))
				.orderBy(desc(feedback.createdAt), desc(feedback.id))
				.limit(query.limit ?? 30),
		}),
		{
			auth: true,
			query: ListFeedbackQuery,
			response: { [StatusCodes.OK]: FeedbackListResponse },
			detail: { summary: "List current user's feedback", tags: ["Feedback"] },
		},
	)
	.post(
		"",
		async ({ profile, authorization, body }) => {
			const subjectUnitId = body.subjectUnitId;
			if (subjectUnitId) {
				await authorization.unit.ensureCanRead(subjectUnitId);
			}
			if (body.realmId) {
				await authorization.unit.ensureCanRead(
					body.realmId,
					() => new UnitNotFound("Realm"),
				);
				if (subjectUnitId && subjectUnitId !== body.realmId) {
					const [association] = await database
						.select({ id: realmContent.unitId })
						.from(realmContent)
						.where(
							and(
								eq(realmContent.realmId, body.realmId),
								eq(realmContent.unitId, subjectUnitId),
							),
						)
						.limit(1);
					if (!association) throw new FeedbackRealmMismatch();
				}
			}
			const created = await database.transaction(async (tx) => {
				const [row] = await tx
					.insert(feedback)
					.values({
						profileId: profile.unitId,
						kind: body.type,
						content: body.content,
						url: body.url,
						subjectUnitId: body.subjectUnitId,
					})
					.returning(feedbackSelection);
				if (!row) throw new Error("Feedback insertion did not return a row");
				if (row.type === "report")
					await tx.insert(moderationCase).values({
						authority: body.realmId ? "realm" : "platform",
						realmId: body.realmId,
						targetKind: "feedback",
						targetId: row.id,
						reporterProfileId: profile.unitId,
						reason: body.content,
					});
				return row;
			});
			return created;
		},
		{
			write: true,
			body: CreateFeedbackBody,
			response: {
				[StatusCodes.OK]: FeedbackResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["FeedbackRealmMismatch"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Submit feedback or report", tags: ["Feedback"] },
		},
	);
