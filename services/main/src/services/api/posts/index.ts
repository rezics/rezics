import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { isPrimaryUnitLocalization, primaryUnitTitle } from "../../units/localization";
import {
	post,
	postReply,
	profile as profileTable,
	realmUnit,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { parseJsonCursor } from "../../pagination";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertAddressedUnit } from "../../units/slug-address";
import { generateSlugLabel } from "../../units/slug";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import {
	ReplyListResponse,
	ReplyThreadResponse,
	toPortableTextResponse,
	PostDetailResponse,
	PostListResponse,
	toApiErrorResponse,
} from "../schema/response";
import {
	CreateReplyBody,
	CreatePostBody,
	ListRepliesQuery,
	ListPostsQuery,
	PostParams,
	ReplyParams,
	ReplyThreadQuery,
	RootPostParams,
	UpdatePostBody,
	UpdateReplyBody,
} from "./schema";
import {
	ParentReplyNotFound,
	PostLocalizationNotFound,
	PostLocked,
	PostNotFound,
	ReplyDepthExceeded,
	ReplyPostNotFound,
} from "./errors";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const ordinaryPostKind = sql<"post" | "reply">`${post.kind}::text`;

const primaryRealmId = sql<string | null>`(
	select rc.realm_id from realm_unit rc
	where rc.unit_id = ${post.id}
		and rc.status = 'visible'
	order by rc.created_at, rc.realm_id limit 1
)`;
const replyCount = sql<number>`(
	select count(*)::int
	from post_reply counted_reply
	join unit counted_unit on counted_unit.id = counted_reply.post_id
	where counted_unit.deleted_at is null
		and (
			(${post.kind} = 'post'::post_kind and counted_reply.root_post_id = ${post.id})
			or (${post.kind} = 'reply'::post_kind and counted_reply.parent_post_id = ${post.id})
		)
)`;

function toReplyResponse<
	T extends {
		id: string;
		authorId: string;
		authorName: string | null;
		rootPostId: string;
		parentPostId: string | null;
		contextRealmId: string | null;
		depth: number;
		body: unknown;
		moderationStatus: string;
		deletedAt: Date | null;
		latestRevisionId: string | null;
		createdAt: Date;
		updatedAt: Date;
	},
>(row: T) {
	const body = toPortableTextResponse(row.body);
	return {
		id: row.id,
		postKind: "reply" as const,
		authorId: row.authorId,
		authorName: row.authorName,
		rootPostId: row.rootPostId,
		parentPostId: row.parentPostId,
		contextRealmId: row.contextRealmId,
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
	authorId: post.authorProfileId,
	authorName: primaryUnitTitle(profileTable.id),
	rootPostId: postReply.rootPostId,
	parentPostId: postReply.parentPostId,
	contextRealmId: postReply.contextRealmId,
	depth: postReply.depth,
	body: unitLocalization.content,
	moderationStatus: unit.moderationStatus,
	deletedAt: unit.deletedAt,
	latestRevisionId: unitRevisionHead.revisionId,
	createdAt: unit.createdAt,
	updatedAt: unit.updatedAt,
};

export default new Elysia()
	.use(session)
	.group("/posts", (app) =>
		app
			.get(
				"",
				async ({ query }) => ({
					items: (
						await database
							.select({
								id: post.id,
								postKind: ordinaryPostKind,
								authorId: post.authorProfileId,
								authorName: primaryUnitTitle(profileTable.id),
								realmId: primaryRealmId,
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
							.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
							.leftJoin(postReply, eq(postReply.postId, post.id))
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
							.limit(query.limit ?? 20)
					).map((item) => ({ ...item, body: toPortableTextResponse(item.body) })),
				}),
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
						const created = await insertAddressedUnit(tx, {
							kind: "post",
							slugScopeId: profile.unitId,
							slug: generateSlugLabel(body.title, "post"),
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
						});
						await tx.insert(post).values({
							id: created.id,
							authorProfileId: profile.unitId,
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
						if (body.realmId)
							await tx
								.insert(realmUnit)
								.values({ realmId: body.realmId, unitId: created.id });
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
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
						]),
					},
					detail: { summary: "Create post", tags: ["Posts"] },
				},
			)
			.get(
				"/:postId",
				async ({ params, request }) => {
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
							authorId: post.authorProfileId,
							realmId: primaryRealmId,
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
							),
						)
						.limit(1);
					if (!row) throw new PostNotFound();
					return {
						...row,
						body: toPortableTextResponse(row.body),
						capabilities: { canEdit: await authorization.unit.canUpdate(row.id) },
					};
				},
				{
					params: PostParams,
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
					await ensureRootPost(params.postId);
					const rows = await database
						.select(replySelection)
						.from(postReply)
						.innerJoin(post, eq(post.id, postReply.postId))
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, postReply.postId),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, postReply.postId))
						.where(
							and(
								eq(postReply.rootPostId, params.postId),
								query.parentPostId
									? eq(postReply.parentPostId, query.parentPostId)
									: undefined,
							),
						)
						.orderBy(postReply.createdAt, postReply.postId)
						.limit(query.limit ?? 100);
					return { items: rows.map(toReplyResponse) };
				},
				{
					params: RootPostParams,
					query: ListRepliesQuery,
					response: {
						[StatusCodes.OK]: ReplyListResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
						]),
					},
					detail: { summary: "List reply posts", tags: ["Posts"] },
				},
			)
			.get(
				"/thread",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request.headers, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.postId,
						() => new UnitNotFound("Post"),
					);
					await ensureRootPost(params.postId);
					const viewerId = identity.profile?.unitId;
					const rows = await database
						.select({
							...replySelection,
							childCount: sql<number>`(
								select count(*)::int from post_reply child
								join unit child_unit on child_unit.id = child.post_id
								where child.parent_post_id = ${postReply.postId} and child_unit.deleted_at is null
							)`,
							upvote: sql<number>`(
								select count(*)::int from unit_reaction r
								where r.unit_id = ${postReply.postId} and r.reaction = 'upvote'
									and r.realm_id is not distinct from ${postReply.contextRealmId}
							)`,
							downvote: sql<number>`(
								select count(*)::int from unit_reaction r
								where r.unit_id = ${postReply.postId} and r.reaction = 'downvote'
									and r.realm_id is not distinct from ${postReply.contextRealmId}
							)`,
							viewerReaction: viewerId
								? sql<
										string | null
									>`(select r.reaction::text from unit_reaction r where r.unit_id = ${postReply.postId} and r.profile_id = ${viewerId} and r.realm_id is not distinct from ${postReply.contextRealmId} limit 1)`
								: sql<string | null>`null`,
						})
						.from(postReply)
						.innerJoin(post, eq(post.id, postReply.postId))
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.innerJoin(profileTable, eq(profileTable.id, post.authorProfileId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, postReply.postId),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, postReply.postId))
						.where(
							and(
								eq(postReply.rootPostId, params.postId),
								query.parentPostId
									? eq(postReply.parentPostId, query.parentPostId)
									: isNull(postReply.parentPostId),
							),
						);
					const ranked = rows
						.map((row) => ({
							...toReplyResponse(row),
							childCount: row.childCount,
							reactions: { upvote: row.upvote, downvote: row.downvote },
							viewerReaction: row.viewerReaction,
						}))
						.sort((left, right) => {
							if (query.sort === "new")
								return right.createdAt.getTime() - left.createdAt.getTime();
							const leftScore =
								left.reactions.upvote -
								left.reactions.downvote +
								(query.sort === "top" ? 0 : Math.min(left.childCount, 10) * 0.15);
							const rightScore =
								right.reactions.upvote -
								right.reactions.downvote +
								(query.sort === "top" ? 0 : Math.min(right.childCount, 10) * 0.15);
							return (
								rightScore - leftScore ||
								right.createdAt.getTime() - left.createdAt.getTime()
							);
						});
					const offset = decodeReplyOffset(query.cursor);
					const limit = query.limit ?? 20;
					return {
						items: ranked.slice(offset, offset + limit),
						nextCursor:
							offset + limit < ranked.length
								? Buffer.from(
										JSON.stringify({ v: 1, offset: offset + limit }),
									).toString("base64url")
								: null,
					};
				},
				{
					params: RootPostParams,
					query: ReplyThreadQuery,
					response: {
						[StatusCodes.OK]: ReplyThreadResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
						]),
					},
					detail: { summary: "List one reply-post branch", tags: ["Posts"] },
				},
			)
			.post(
				"",
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(
						params.postId,
						() => new UnitNotFound("Post"),
					);
					await ensureRootPost(params.postId);
					const [realm] = await database
						.select({ id: realmUnit.realmId })
						.from(realmUnit)
						.where(
							and(
								eq(realmUnit.unitId, params.postId),
								body.realmId ? eq(realmUnit.realmId, body.realmId) : undefined,
							),
						)
						.orderBy(realmUnit.realmId)
						.limit(1);
					if (body.realmId && !realm) throw new UnitNotFound("Realm");
					await authorization.realm.ensureParticipation(realm?.id, "post");
					const createdReply = await database.transaction(async (tx) => {
						const [root] = await tx
							.select({ authorId: post.authorProfileId, locked: post.locked })
							.from(post)
							.where(and(eq(post.id, params.postId), eq(post.kind, "post")))
							.limit(1);
						if (!root) throw new PostNotFound();
						if (root.locked) throw new PostLocked();
						let depth = 0;
						let recipientId = root.authorId;
						if (body.parentPostId) {
							const [parent] = await tx
								.select({
									rootPostId: postReply.rootPostId,
									depth: postReply.depth,
									authorId: post.authorProfileId,
									locked: post.locked,
								})
								.from(postReply)
								.innerJoin(post, eq(post.id, postReply.postId))
								.innerJoin(unit, eq(unit.id, postReply.postId))
								.where(
									and(
										eq(postReply.postId, body.parentPostId),
										isNull(unit.deletedAt),
									),
								)
								.limit(1);
							if (!parent || parent.rootPostId !== params.postId)
								throw new ParentReplyNotFound();
							if (parent.locked) throw new PostLocked();
							if (parent.depth >= 64) throw new ReplyDepthExceeded();
							depth = parent.depth + 1;
							recipientId = parent.authorId;
						}
						const created = await insertAddressedUnit(tx, {
							kind: "post",
							slugScopeId: params.postId,
							slug: generateSlugLabel("reply", "reply"),
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
						});
						await tx.insert(post).values({
							id: created.id,
							authorProfileId: profile.unitId,
							kind: "reply",
						});
						await tx.insert(postReply).values({
							postId: created.id,
							rootPostId: params.postId,
							parentPostId: body.parentPostId,
							contextRealmId: realm?.id,
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
						if (realm)
							await tx.insert(realmUnit).values({
								realmId: realm.id,
								unitId: created.id,
							});
						await recordUnitRevision(tx, {
							unitId: created.id,
							actorProfileId: profile.unitId,
							event: "create",
						});
						const notificationId = await createNotification(tx, {
							recipientProfileId: recipientId,
							actorProfileId: profile.unitId,
							kind: "reply",
							subjectUnitId: created.id,
						});
						return { id: created.id, notificationId };
					});
					await deliverNotificationEmail(createdReply.notificationId);
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
							"PostLocked",
							"ReplyDepthExceeded",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"ParentReplyNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
						]),
					},
					detail: { summary: "Create reply post", tags: ["Posts"] },
				},
			)
			.patch(
				"/:replyPostId",
				async ({ params, profile, authorization, body }) => {
					const row = await getReplyPost(params.postId, params.replyPostId);
					if (!(await authorization.unit.canUpdate(params.replyPostId))) {
						if (row.contextRealmId)
							await authorization.realm.ensureCapability(
								row.contextRealmId,
								"realm.units.moderate",
							);
						else
							await authorization.unit.ensureCanUpdate(params.replyPostId, [
								["localizations"],
							]);
					}
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
							"RealmCapabilityRequired",
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
					const row = await getReplyPost(params.postId, params.replyPostId);
					if (!(await authorization.unit.canUpdate(params.replyPostId))) {
						if (row.contextRealmId)
							await authorization.realm.ensureCapability(
								row.contextRealmId,
								"realm.units.moderate",
							);
						else await authorization.unit.ensure(params.replyPostId, "unit.delete");
					}
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
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"RealmCapabilityRequired",
						]),
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
		.select({
			contextRealmId: postReply.contextRealmId,
		})
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

async function ensureRootPost(postId: string) {
	const [row] = await database
		.select({ id: post.id })
		.from(post)
		.innerJoin(unit, eq(unit.id, post.id))
		.where(and(eq(post.id, postId), eq(post.kind, "post"), isNull(unit.deletedAt)))
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

const ReplyOffsetCursor = t.Object(
	{ v: t.Literal(1), offset: t.Integer({ minimum: 0 }) },
	{ additionalProperties: false },
);

function decodeReplyOffset(cursor?: string) {
	if (!cursor) return 0;
	try {
		return parseJsonCursor(cursor, ReplyOffsetCursor).offset;
	} catch {
		return 0;
	}
}
