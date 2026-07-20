import { StatusCodes } from "http-status-codes";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { isPrimaryUnitLocalization } from "../../units/localization";
import {
	post,
	postReply,
	postReplyStat,
	postScore,
	realmUnit,
	score,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitRevisionHead,
	unitStatusEvent,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { fractionalPositionAt } from "../../ordering/position";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import {
	ensurePostMountTargetingAllowed,
	ensureReplyPostTargetingAllowed,
	ensureSubjectPostTargetingAllowed,
	findPostTargetingLock,
	getPostTargetingLockedUnitIds,
} from "../../posts/targeting";
import { getPublisherSummariesByUnitIds, type UnitPublisherSummary } from "../../units/status";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import {
	ReplyListResponse,
	toPortableTextResponse,
	PostDetailResponse,
	PostListResponse,
	toApiErrorResponse,
} from "../schema/response";
import {
	CreateReplyBody,
	CreatePostBody,
	GetPostQuery,
	ListRepliesQuery,
	ListPostsQuery,
	PostParams,
	PostScoreListResponse,
	ReplyParams,
	ReplacePostScoresBody,
	RootPostParams,
	UpdatePostBody,
	UpdateReplyBody,
} from "./schema";
import {
	ParentReplyNotFound,
	PostLocalizationNotFound,
	PostNotFound,
	PostScoreDuplicate,
	PostScoreNotFound,
	ReplyDepthExceeded,
	ReplyPostNotFound,
} from "./errors";
import { selectReplyTree } from "./reply-tree-query";

const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const ordinaryPostKind = sql<"post" | "reply">`${post.kind}::text`;

const replyCount = sql<unknown>`coalesce(case when ${post.kind} = 'post'::post_kind
	then ${postReplyStat.undeletedDescendantCount}
	else ${postReplyStat.undeletedDirectCount} end, 0)`;

function toReplyResponse<
	T extends {
		id: string;
		rootPostId: string;
		parentPostId: string | null;
		depth: number;
		body: unknown;
		moderationStatus: string;
		deletedAt: Date | null;
		latestRevisionId: string | null;
		createdAt: Date;
		updatedAt: Date;
	},
>(row: T, publishers: readonly UnitPublisherSummary[]) {
	const body = toPortableTextResponse(row.body);
	return {
		id: row.id,
		postKind: "reply" as const,
		publishers: [...publishers],
		rootPostId: row.rootPostId,
		parentPostId: row.parentPostId,
		depth: row.depth,
		body: row.deletedAt ? { ...body, content: [] } : body,
		status: row.deletedAt ? "deleted" : row.moderationStatus,
		latestRevisionId: row.latestRevisionId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

const replySelection = {
	id: postReply.postId,
	rootPostId: postReply.rootPostId,
	parentPostId: postReply.parentPostId,
	depth: postReply.depth,
	body: unitLocalization.content,
	moderationStatus: unit.moderationStatus,
	deletedAt: unit.deletedAt,
	latestRevisionId: unitRevisionHead.revisionId,
	createdAt: unit.createdAt,
	updatedAt: unit.updatedAt,
};

async function selectPostScores(postId: string) {
	return database
		.select({
			scoreId: score.id,
			profileId: score.profileId,
			unitId: score.unitId,
			realmId: score.realmId,
			value: score.value,
			position: postScore.position,
			updatedAt: score.updatedAt,
		})
		.from(postScore)
		.innerJoin(score, eq(score.id, postScore.scoreId))
		.where(eq(postScore.postId, postId))
		.orderBy(asc(postScore.position), asc(postScore.scoreId));
}

export default new Elysia()
	.use(session)
	.group("/posts", (app) =>
		app
			.get(
				"/:postId/scores",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(params.postId, () => new PostNotFound());
					const [record] = await database
						.select({ id: post.id })
						.from(post)
						.where(eq(post.id, params.postId))
						.limit(1);
					if (!record) throw new PostNotFound();
					return { items: await selectPostScores(params.postId) };
				},
				{
					params: PostParams,
					response: {
						[StatusCodes.OK]: PostScoreListResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PostNotFound"]),
					},
					detail: { summary: "List Post Scores", tags: ["Posts"] },
				},
			)
			.put(
				"/:postId/scores",
				async ({ params, authorization, body }) => {
					await authorization.unit.ensureCanUpdate(params.postId, [
						["relations", "scores"],
					]);
					const scoreIds = body.map(({ scoreId }) => scoreId);
					if (new Set(scoreIds).size !== scoreIds.length) throw new PostScoreDuplicate();
					await database.transaction(async (tx) => {
						const [record] = await tx
							.select({ id: post.id })
							.from(post)
							.where(eq(post.id, params.postId))
							.limit(1);
						if (!record) throw new PostNotFound();
						if (scoreIds.length) {
							const found = await tx
								.select({ id: score.id })
								.from(score)
								.where(inArray(score.id, scoreIds));
							if (found.length !== scoreIds.length) throw new PostScoreNotFound();
						}
						await tx.delete(postScore).where(eq(postScore.postId, params.postId));
						if (body.length)
							await tx.insert(postScore).values(
								body.map(({ scoreId }, index) => ({
									postId: params.postId,
									scoreId,
									position: fractionalPositionAt(index),
								})),
							);
					});
					return { items: await selectPostScores(params.postId) };
				},
				{
					access: "contribute:unit:update",
					params: PostParams,
					body: ReplacePostScoresBody,
					response: {
						[StatusCodes.OK]: PostScoreListResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"PostScoreNotFound",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"PostScoreDuplicate",
						]),
					},
					detail: { summary: "Replace Post Scores", tags: ["Posts"] },
				},
			)
			.get(
				"",
				async ({ query }) => {
					const rows = await database
						.select({
							id: post.id,
							postKind: ordinaryPostKind,
							subjectId: post.subjectUnitId,
							rootPostId: postReply.rootPostId,
							parentPostId: postReply.parentPostId,
							body: unitLocalization.content,
							replyCount,
							title: unitLocalization.title,
							latestRevisionId: unitRevisionHead.revisionId,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(postReply, eq(postReply.postId, post.id))
						.leftJoin(postReplyStat, eq(postReplyStat.postId, post.id))
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, post.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`,
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								isNull(unit.deletedAt),
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible')`
									: undefined,
								query.subjectId
									? eq(post.subjectUnitId, query.subjectId)
									: undefined,
							),
						)
						.orderBy(desc(unit.createdAt), desc(unit.id))
						.limit(query.limit ?? 20);
					const publishers = await getPublisherSummariesByUnitIds(
						rows.map(({ id }) => id),
					);
					return {
						items: rows.map((item) => ({
							...item,
							realmId: query.realmId ?? null,
							publishers: publishers.get(item.id) ?? [],
							replyCount: toSafeInteger(item.replyCount, "reply count"),
							body: toPortableTextResponse(item.body),
						})),
					};
				},
				{
					query: ListPostsQuery,
					response: { [StatusCodes.OK]: PostListResponse },
					detail: { summary: "List posts", tags: ["Posts"] },
				},
			)
			.post(
				"",
				async ({ profile, authorization, body }) => {
					await authorization.realm.ensureParticipation(body.realmId, "post");
					if (body.subjectId) {
						await authorization.unit.ensureCanRead(body.subjectId);
					}
					const id = await database.transaction(async (tx) => {
						if (body.subjectId)
							await authorization.entity.ensureSubjectAssociationAllowedIfEntity(
								tx,
								body.subjectId,
							);
						const created = await insertUnit(tx, {
							kind: "post",
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
							statusActor: { kind: "profile", profileId: profile.unitId },
						});
						await ensureSubjectPostTargetingAllowed(tx, {
							sourcePostId: created.id,
							subjectUnitId: body.subjectId,
							...(body.realmId ? { realmId: body.realmId } : {}),
						});
						await tx.insert(post).values({
							id: created.id,
							subjectUnitId: body.subjectId,
						});
						await tx.insert(unitLocalization).values({
							unitId: created.id,
							language: body.language,
							title: body.title,
							content: body.body,
							contentStatus: "published",
						});
						await tx.insert(unitAccessBinding).values({
							unitId: created.id,
							subjectKind: "profile",
							profileId: profile.unitId,
							role: "owner",
							scope: [],
							grantedByProfileId: profile.unitId,
						});
						if (body.realmId) {
							await ensurePostMountTargetingAllowed(tx, {
								postId: created.id,
								realmId: body.realmId,
							});
							await tx
								.insert(realmUnit)
								.values({ realmId: body.realmId, unitId: created.id });
						}
						await recordUnitRevision(tx, {
							unitId: created.id,
							actorProfileId: profile.unitId,
							event: "create",
						});
						return created.id;
					});
					return { id };
				},
				{
					access: "contribute:unit:create",
					body: CreatePostBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"EntityEntryNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
							"PostTargetingLocked",
						]),
					},
					detail: { summary: "Create post", tags: ["Posts"] },
				},
			)
			.get(
				"/:postId",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.postId,
						() => new UnitNotFound("Post"),
					);
					const [row] = await database
						.select({
							id: post.id,
							postKind: ordinaryPostKind,
							subjectId: post.subjectUnitId,
							rootPostId: postReply.rootPostId,
							parentPostId: postReply.parentPostId,
							replyCount,
							title: unitLocalization.title,
							body: unitLocalization.content,
							latestRevisionId: unitRevisionHead.revisionId,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(postReply, eq(postReply.postId, post.id))
						.leftJoin(postReplyStat, eq(postReplyStat.postId, post.id))
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, post.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								eq(post.id, params.postId),
								sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`,
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible')`
									: undefined,
							),
						)
						.limit(1);
					if (!row) throw new PostNotFound();
					const publishers =
						(await getPublisherSummariesByUnitIds([row.id])).get(row.id) ?? [];
					return {
						...row,
						realmId: query.realmId ?? null,
						publishers,
						replyCount: toSafeInteger(row.replyCount, "reply count"),
						body: toPortableTextResponse(row.body),
						capabilities: {
							canEdit: await authorization.unit.canUpdate(row.id),
							canReply: !(await findPostTargetingLock(database, {
								targets:
									row.postKind === "reply" && row.rootPostId
										? [
												{ relation: "root", unitId: row.rootPostId },
												{ relation: "parent", unitId: row.id },
											]
										: [{ relation: "root", unitId: row.id }],
								...(query.realmId ? { realmId: query.realmId } : {}),
							})),
						},
					};
				},
				{
					params: PostParams,
					query: GetPostQuery,
					response: {
						[StatusCodes.OK]: PostDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
						]),
					},
					detail: { summary: "Get post", tags: ["Posts"] },
				},
			)
			.patch(
				"/:postId",
				async ({ params, profile, authorization, body }) => {
					await ensureOrdinaryPost(params.postId);
					await authorization.unit.ensureCanUpdate(params.postId, [["localizations"]]);
					await database.transaction(async (tx) => {
						const [current] = await tx
							.select({ language: unitLocalization.language })
							.from(unitLocalization)
							.where(
								and(
									eq(unitLocalization.unitId, params.postId),
									isPrimaryUnitLocalization(unitLocalization.unitId),
								),
							)
							.limit(1);
						if (!current) throw new PostLocalizationNotFound();
						await tx
							.update(unitLocalization)
							.set({ title: body.title, content: body.body })
							.where(
								and(
									eq(unitLocalization.unitId, params.postId),
									eq(unitLocalization.language, current.language),
								),
							);
						await recordUnitRevision(tx, {
							unitId: params.postId,
							actorProfileId: profile.unitId,
							event: "update",
							baseRevisionId: body.baseRevisionId,
							message: body.editSummary,
							minor: body.minor,
						});
					});
					return { id: params.postId };
				},
				{
					access: "contribute:unit:update",
					params: PostParams,
					body: UpdatePostBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"PostLocalizationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
					},
					detail: { summary: "Update post", tags: ["Posts"] },
				},
			)
			.delete(
				"/:postId",
				async ({ params, profile, authorization }) => {
					await ensureOrdinaryPost(params.postId);
					await authorization.unit.ensure(params.postId, "unit.delete");
					await database.transaction(async (tx) => {
						await tx
							.update(unit)
							.set({ deletedAt: new Date() })
							.where(and(eq(unit.id, params.postId), eq(unit.kind, "post")));
						await recordUnitRevision(tx, {
							unitId: params.postId,
							actorProfileId: profile.unitId,
							event: "delete",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:delete",
					params: PostParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
						]),
					},
					detail: {
						summary: "Delete post",
						tags: ["Posts"],
						responses: NoContentResponse,
					},
				},
			),
	)
	.group("/posts/:postId/replies", (app) =>
		app
			.get(
				"",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.postId,
						() => new UnitNotFound("Post"),
					);
					await ensureRootPost(params.postId, query.realmId);
					const selection = await selectReplyTree({
						rootPostId: params.postId,
						...(query.realmId ? { realmId: query.realmId } : {}),
						...(query.parentPostId ? { parentPostId: query.parentPostId } : {}),
						...(query.cursor ? { cursor: query.cursor } : {}),
						...(query.limit ? { limit: query.limit } : {}),
					});
					if (!selection.items.length)
						return { items: [], nextCursor: selection.nextCursor };
					const rows = await database
						.select(replySelection)
						.from(postReply)
						.innerJoin(post, eq(post.id, postReply.postId))
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, postReply.postId),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, postReply.postId))
						.where(
							inArray(
								postReply.postId,
								selection.items.map(({ postId }) => postId),
							),
						);
					const publishers = await getPublisherSummariesByUnitIds(
						rows.map(({ id }) => id),
					);
					const lockedTargetIds = await getPostTargetingLockedUnitIds(database, {
						targetUnitIds: [params.postId, ...rows.map(({ id }) => id)],
						...(query.realmId ? { realmId: query.realmId } : {}),
					});
					const rowById = new Map(rows.map((row) => [row.id, row]));
					return {
						items: await Promise.all(
							selection.items.map(async (selected) => {
								const row = rowById.get(selected.postId);
								if (!row)
									throw new Error(
										`Selected reply ${selected.postId} was not hydrated`,
									);
								return {
									...toReplyResponse(row, publishers.get(row.id) ?? []),
									hasMoreChildren: selected.hasMoreChildren,
									childEndCursor: selected.childEndCursor,
									capabilities: {
										canEdit: await authorization.unit.canUpdate(row.id),
										canReply:
											!lockedTargetIds.has(row.rootPostId) &&
											!lockedTargetIds.has(row.id),
									},
								};
							}),
						),
						nextCursor: selection.nextCursor,
					};
				},
				{
					params: RootPostParams,
					query: ListRepliesQuery,
					response: {
						[StatusCodes.OK]: ReplyListResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
						]),
					},
					detail: { summary: "List a bounded reply-post tree", tags: ["Posts"] },
				},
			)
			.post(
				"",
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(
						params.postId,
						() => new UnitNotFound("Post"),
					);
					await ensureRootPost(params.postId, body.realmId);
					await authorization.realm.ensureParticipation(body.realmId, "post");
					const createdReply = await database.transaction(async (tx) => {
						const [root] = await tx
							.select({ id: post.id })
							.from(post)
							.where(and(eq(post.id, params.postId), eq(post.kind, "post")))
							.limit(1);
						if (!root) throw new PostNotFound();
						let depth = 0;
						let recipientUnitId = params.postId;
						if (body.parentPostId) {
							const [parent] = await tx
								.select({
									rootPostId: postReply.rootPostId,
									depth: postReply.depth,
								})
								.from(postReply)
								.innerJoin(post, eq(post.id, postReply.postId))
								.innerJoin(unit, eq(unit.id, postReply.postId))
								.where(
									and(
										eq(postReply.postId, body.parentPostId),
										isNull(unit.deletedAt),
										body.realmId
											? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${postReply.postId} and rc.realm_id = ${body.realmId} and rc.status = 'visible')`
											: undefined,
									),
								)
								.limit(1);
							if (!parent || parent.rootPostId !== params.postId)
								throw new ParentReplyNotFound();
							if (parent.depth >= 64) throw new ReplyDepthExceeded();
							depth = parent.depth + 1;
							recipientUnitId = body.parentPostId;
						}
						const created = await insertUnit(tx, {
							kind: "post",
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
							statusActor: { kind: "profile", profileId: profile.unitId },
						});
						await ensureReplyPostTargetingAllowed(tx, {
							sourcePostId: created.id,
							rootPostId: params.postId,
							parentPostId: body.parentPostId,
							...(body.realmId ? { realmId: body.realmId } : {}),
						});
						await tx.insert(post).values({
							id: created.id,
							kind: "reply",
						});
						await tx.insert(postReply).values({
							postId: created.id,
							rootPostId: params.postId,
							parentPostId: body.parentPostId,
							depth,
						});
						await tx.insert(unitLocalization).values({
							unitId: created.id,
							language: body.language,
							content: body.body,
							contentStatus: "published",
						});
						await tx.insert(unitAccessBinding).values({
							unitId: created.id,
							subjectKind: "profile",
							profileId: profile.unitId,
							role: "owner",
							scope: [],
							grantedByProfileId: profile.unitId,
						});
						if (body.realmId) {
							await ensurePostMountTargetingAllowed(tx, {
								postId: created.id,
								realmId: body.realmId,
							});
							await tx.insert(realmUnit).values({
								realmId: body.realmId,
								unitId: created.id,
							});
						}
						await recordUnitRevision(tx, {
							unitId: created.id,
							actorProfileId: profile.unitId,
							event: "create",
						});
						const recipients = await tx
							.selectDistinct({ profileId: unitStatusEvent.changedByProfileId })
							.from(unitStatusEvent)
							.where(
								and(
									eq(unitStatusEvent.unitId, recipientUnitId),
									eq(unitStatusEvent.toStatus, "published"),
									eq(unitStatusEvent.actorKind, "profile"),
									eq(unitStatusEvent.actorHidden, false),
								),
							);
						const notificationIds: string[] = [];
						for (const recipient of recipients) {
							if (!recipient.profileId || recipient.profileId === profile.unitId)
								continue;
							const notificationId = await createNotification(tx, {
								recipientProfileId: recipient.profileId,
								actorProfileId: profile.unitId,
								kind: "reply",
								subjectUnitId: created.id,
							});
							if (notificationId) notificationIds.push(notificationId);
						}
						return { id: created.id, notificationIds };
					});
					await Promise.all(createdReply.notificationIds.map(deliverNotificationEmail));
					return { id: createdReply.id };
				},
				{
					access: "contribute:interaction:write",
					params: RootPostParams,
					body: CreateReplyBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"ReplyDepthExceeded",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"ParentReplyNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
							"PostTargetingLocked",
						]),
					},
					detail: { summary: "Create reply post", tags: ["Posts"] },
				},
			)
			.patch(
				"/:replyPostId",
				async ({ params, profile, authorization, body }) => {
					await getReplyPost(params.postId, params.replyPostId);
					await authorization.unit.ensureCanUpdate(params.replyPostId, [
						["localizations"],
					]);
					await authorization.unit.ensureOperationAllowed(params.replyPostId, [
						"localizations",
					]);
					await database.transaction(async (tx) => {
						await tx
							.update(unitLocalization)
							.set({ content: body.body })
							.where(
								and(
									eq(unitLocalization.unitId, params.replyPostId),
									isPrimaryUnitLocalization(unitLocalization.unitId),
								),
							);
						await recordUnitRevision(tx, {
							unitId: params.replyPostId,
							actorProfileId: profile.unitId,
							event: "update",
							baseRevisionId: body.baseRevisionId,
							message: body.editSummary,
							minor: body.minor,
						});
					});
					return { id: params.replyPostId };
				},
				{
					access: "contribute:interaction:write",
					params: ReplyParams,
					body: UpdateReplyBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"UnitProtected",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"ReplyPostNotFound",
							"UnitNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
					},
					detail: { summary: "Update reply post", tags: ["Posts"] },
				},
			)
			.delete(
				"/:replyPostId",
				async ({ params, profile, authorization }) => {
					await getReplyPost(params.postId, params.replyPostId);
					await authorization.unit.ensure(params.replyPostId, "unit.delete");
					await authorization.unit.ensureOperationAllowed(params.replyPostId, ["unit"]);
					await database.transaction(async (tx) => {
						await tx
							.update(unit)
							.set({ deletedAt: new Date() })
							.where(eq(unit.id, params.replyPostId));
						await recordUnitRevision(tx, {
							unitId: params.replyPostId,
							actorProfileId: profile.unitId,
							event: "delete",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:interaction:write",
					params: ReplyParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"ReplyPostNotFound",
							"UnitNotFound",
						]),
					},
					detail: {
						summary: "Delete reply post",
						tags: ["Posts"],
						responses: NoContentResponse,
					},
				},
			),
	);

async function getReplyPost(rootPostId: string, postId: string) {
	const [row] = await database
		.select({ postId: postReply.postId })
		.from(postReply)
		.innerJoin(unit, eq(unit.id, postReply.postId))
		.where(
			and(
				eq(postReply.postId, postId),
				eq(postReply.rootPostId, rootPostId),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (!row) throw new ReplyPostNotFound();
	return row;
}

async function ensureRootPost(postId: string, realmId?: string) {
	const [row] = await database
		.select({ id: post.id })
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.where(
			and(
				eq(post.id, postId),
				eq(post.kind, "post"),
				isNull(unit.deletedAt),
				realmId
					? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${realmId} and rc.status = 'visible')`
					: undefined,
			),
		)
		.limit(1);
	if (!row) throw new PostNotFound();
}

async function ensureOrdinaryPost(postId: string) {
	const [row] = await database
		.select({ id: post.id })
		.from(post)
		.where(
			and(eq(post.id, postId), sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`),
		)
		.limit(1);
	if (!row) throw new PostNotFound();
}
