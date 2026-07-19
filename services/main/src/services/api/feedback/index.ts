import { StatusCodes } from "http-status-codes";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import type { DatabaseTransaction } from "../../database";
import { feedback, moderationCase, realmUnit } from "../../database/schema";
import { createGovernanceNotePost, listGovernanceNotes } from "../../governance/note-service";
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
	url: feedback.url,
	subjectUnitId: feedback.subjectUnitId,
	status: sql<string>`case when ${feedback.resolvedAt} is null then 'open' else 'resolved' end`,
	resolutionCode: feedback.resolutionCode,
	createdAt: feedback.createdAt,
	updatedAt: feedback.updatedAt,
};

type FeedbackRecord = {
	id: string;
	type: (typeof feedback.$inferSelect)["kind"];
	url: string | null;
	subjectUnitId: string | null;
	status: string;
	resolutionCode: (typeof feedback.$inferSelect)["resolutionCode"];
	createdAt: Date;
	updatedAt: Date;
};

async function presentFeedbackRecords(tx: DatabaseTransaction, rows: FeedbackRecord[]) {
	const notes = await listGovernanceNotes(tx, {
		subjectKind: "feedback",
		subjectIds: rows.map((row) => row.id),
		roles: ["evidence", "public_notice"],
	});
	return rows.map((row) => {
		const evidence = notes.find(
			(note) => note.subjectId === row.id && note.role === "evidence",
		);
		if (!evidence) throw new Error(`Feedback ${row.id} is missing its evidence Post`);
		const publicNotice = notes.find(
			(note) => note.subjectId === row.id && note.role === "public_notice",
		);
		return {
			...row,
			evidence: {
				postId: evidence.postId,
				revisionId: evidence.revisionId,
				language: evidence.language,
				content: evidence.content,
			},
			publicNotice: publicNotice
				? {
						postId: publicNotice.postId,
						revisionId: publicNotice.revisionId,
						language: publicNotice.language,
						content: publicNotice.content,
					}
				: null,
		};
	});
}

export default new Elysia({ prefix: "/feedback" })
	.use(session)
	.get(
		"/me",
		async ({ profile, query }) =>
			database.transaction(async (tx) => {
				const rows = await tx
					.select(feedbackSelection)
					.from(feedback)
					.where(eq(feedback.profileId, profile.unitId))
					.orderBy(desc(feedback.createdAt), desc(feedback.id))
					.limit(query.limit ?? 30);
				return { items: await presentFeedbackRecords(tx, rows) };
			}),
		{
			access: "feedback:write",
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
						.select({ id: realmUnit.unitId })
						.from(realmUnit)
						.where(
							and(
								eq(realmUnit.realmId, body.realmId),
								eq(realmUnit.unitId, subjectUnitId),
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
						url: body.url,
						subjectUnitId: body.subjectUnitId,
					})
					.returning(feedbackSelection);
				if (!row) throw new Error("Feedback insertion did not return a row");
				const evidence = await createGovernanceNotePost(tx, {
					actorProfileId: profile.unitId,
					subjectKind: "feedback",
					subjectId: row.id,
					subjectUnitId: body.subjectUnitId,
					realmId: body.realmId,
					note: { role: "evidence", language: body.language, content: body.content },
				});
				if (row.type === "report")
					await tx.insert(moderationCase).values({
						authority: body.realmId ? "realm" : "platform",
						realmId: body.realmId,
						targetKind: "feedback",
						targetId: row.id,
						reporterProfileId: profile.unitId,
					});
				return {
					...row,
					evidence: {
						...evidence,
						language: body.language,
						content: body.content,
					},
					publicNotice: null,
				};
			});
			return created;
		},
		{
			access: "write:feedback:write",
			body: CreateFeedbackBody,
			response: {
				[StatusCodes.OK]: FeedbackResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["FeedbackRealmMismatch"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Submit feedback or report", tags: ["Feedback"] },
		},
	);
