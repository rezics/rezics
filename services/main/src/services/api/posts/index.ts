import { StatusCodes } from "http-status-codes";
import type { ContentLanguage } from "@rezics/i18n";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { requireContentSpoilerLevel } from "../../content-labels/presentation";
import { database } from "../../database";
import { runVoteTransaction } from "../../database/vote-admission";
import { toSafeInteger } from "../../database/integer";
import { resolvedUnitLocalizationLanguage } from "../../units/localization";
import {
	creditAttribution,
	post,
	postReply,
	postReplyStat,
	postScore,
	profile as profileTable,
	score,
	unit,
	unitOwnership,
	unitTag,
	unitLocalization,
	unitRevisionHead,
	profilePreference,
} from "../../database/schema";
import { ContentSpoilerLabelManifest, NsfwContentLabelId } from "../../bootstrap/data";
import { createNotification } from "../../notifications/service";
import { fractionalPositionAt, fractionalPositionBetween } from "../../ordering/position";
import { usesSharedPostLocalizationRoute } from "../../posts/localization-route";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import {
	ensureReplyPostTargetingAllowed,
	ensureSubjectPostTargetingAllowed,
	findPostTargetingLock,
	getPostTargetingLockedUnitIds,
} from "../../posts/targeting";
import { publishPostToRealms } from "../../posts/publication";
import { getPostSubjectPresentation } from "../../posts/presentation";
import { selectPostScores } from "../../posts/scores";
import { selectPostProgressEntry } from "../../posts/progress";
import {
	createProfilePublisherAttribution,
	getAttributionSummariesByUnitIds,
	type UnitAttributionSummary,
} from "../../units/attribution";
import { IdResponse } from "../schema/action-response";
import {
	ReplyListResponse,
	ReplyResponse,
	toPortableTextResponse,
	PostDetailResponse,
	PostListResponse,
	toApiErrorResponse,
	VoteBackpressureResponse,
} from "../schema/response";
import {
	CreateReplyBody,
	CreatePostBody,
	CreateWikiBody,
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
import { applyNewPostTagMentionVotes } from "../../posts/tag-mentions";
import { createWikiPost } from "../../posts/wiki";
import { resolveCanonicalUnitId } from "../../units/merge/canonical";
import { selectReaderChapterLocalization } from "../../content-structure/book-reading";

const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);
const RevisionContributionBadRequestResponse = toApiErrorResponse([
	"RevisionCreditEntityInvalid",
	"RevisionContributionActorRequired",
]);
const ordinaryPostKind = sql<"post" | "reply">`${post.kind}::text`;
const interactivePostKind = sql<
	"post" | "reply" | "excerpt" | "review" | "wiki" | "chapter"
>`${post.kind}::text`;

async function replaceContentSpoilerLabel(
	tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
	input: { readonly postId: string; readonly profileId: string; readonly level: 0 | 1 | 2 },
) {
	const label = ContentSpoilerLabelManifest.find(
		(candidate) => candidate.spoilerLevel === input.level,
	);
	if (!label) throw new Error("Content spoiler label manifest is incomplete");
	await tx.delete(unitTag).where(
		and(
			eq(unitTag.unitId, input.postId),
			inArray(
				unitTag.tagId,
				ContentSpoilerLabelManifest.map(({ id }) => id),
			),
		),
	);
	const [lastPinned] = await tx
		.select({ position: unitTag.position })
		.from(unitTag)
		.where(and(eq(unitTag.unitId, input.postId), eq(unitTag.pinned, true)))
		.orderBy(desc(unitTag.position))
		.limit(1);
	await tx.insert(unitTag).values({
		unitId: input.postId,
		tagId: label.id,
		createdByProfileId: input.profileId,
		pinned: true,
		position: fractionalPositionBetween(lastPinned?.position, null),
	});
}

async function replaceNsfwContentLabel(
	tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
	input: { readonly postId: string; readonly profileId: string; readonly enabled: boolean },
) {
	await tx
		.delete(unitTag)
		.where(and(eq(unitTag.unitId, input.postId), eq(unitTag.tagId, NsfwContentLabelId)));
	if (!input.enabled) return;
	const [lastPinned] = await tx
		.select({ position: unitTag.position })
		.from(unitTag)
		.where(and(eq(unitTag.unitId, input.postId), eq(unitTag.pinned, true)))
		.orderBy(desc(unitTag.position))
		.limit(1);
	await tx.insert(unitTag).values({
		unitId: input.postId,
		tagId: NsfwContentLabelId,
		createdByProfileId: input.profileId,
		pinned: true,
		position: fractionalPositionBetween(lastPinned?.position, null),
	});
}

const replyCount = sql<unknown>`coalesce(case when ${post.kind} = 'reply'::post_kind
	then ${postReplyStat.undeletedDirectCount}
	else ${postReplyStat.undeletedDescendantCount} end, 0)`;

function toReplyResponse<
	T extends {
		id: string;
		language: ContentLanguage;
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
>(
	row: T,
	attributions: readonly UnitAttributionSummary[],
	availableLanguages: readonly ContentLanguage[] = [row.language],
) {
	const body = toPortableTextResponse(row.body, "post.body");
	return {
		id: row.id,
		postKind: "reply" as const,
		language: row.language,
		availableLanguages: [...availableLanguages],
		attributions: [...attributions],
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
	language: unitLocalization.language,
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

export default new Elysia()
	.use(session)
	.group("/posts", (app) =>
		app
			.get(
				"/:postId/scores",
				async ({ params, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const { authorization } = identity;
					await authorization.unit.ensureCanRead(params.postId, () => new PostNotFound());
					const [record] = await database
						.select({ id: post.id })
						.from(post)
						.where(eq(post.id, params.postId))
						.limit(1);
					if (!record) throw new PostNotFound();
					return {
						items: await selectPostScores(params.postId, identity.profile?.unitId),
					};
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
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanUpdate(params.postId, [["relations", "scores"]]);
					const scoreIds = body.map(({ scoreId }) => scoreId);
					if (new Set(scoreIds).size !== scoreIds.length) throw new PostScoreDuplicate();
					await database.transaction(async (tx) => {
						const [record] = await tx
							.select({
								id: post.id,
								kind: post.kind,
								subjectUnitId: post.subjectUnitId,
							})
							.from(post)
							.where(eq(post.id, params.postId))
							.limit(1);
						if (!record) throw new PostNotFound();
						if (scoreIds.length) {
							const existing = await tx
								.select({ scoreId: postScore.scoreId })
								.from(postScore)
								.where(eq(postScore.postId, params.postId));
							const existingScoreIds = existing.map(({ scoreId }) => scoreId);
							const found = await tx
								.select({
									id: score.id,
									realmId: score.realmId,
									unitId: score.unitId,
								})
								.from(score)
								.where(
									and(
										inArray(score.id, scoreIds),
										existingScoreIds.length
											? or(eq(score.profileId, profile.unitId), inArray(score.id, existingScoreIds))
											: eq(score.profileId, profile.unitId),
									),
								);
							if (found.length !== scoreIds.length) throw new PostScoreNotFound();
							if (
								record.kind === "review" &&
								found.some(({ unitId }) => unitId !== record.subjectUnitId)
							)
								throw new PostScoreNotFound();
							if (new Set(found.map(({ realmId }) => realmId)).size !== found.length)
								throw new PostScoreDuplicate();
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
					return {
						items: await selectPostScores(params.postId, profile.unitId),
					};
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
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["PostScoreDuplicate"]),
					},
					detail: { summary: "Replace Post Scores", tags: ["Posts"] },
				},
			)
			.get(
				"",
				async ({ query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const localizationLanguages = query.localizationLanguages ?? [];
					const rows = await database
						.select({
							id: post.id,
							postKind: ordinaryPostKind,
							language: unitLocalization.language,
							subjectId: post.subjectUnitId,
							rootPostId: postReply.rootPostId,
							parentPostId: postReply.parentPostId,
							body: unitLocalization.content,
							replyCount,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							latestRevisionId: unitRevisionHead.revisionId,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
							contentSpoilerLevel: sql<number>`coalesce((
								select manifest.spoiler_level
								from (values
									('019b76da-a800-7370-8000-000000000001'::uuid, 0),
									('019b76da-a800-7370-8000-000000000002'::uuid, 1),
									('019b76da-a800-7370-8000-000000000003'::uuid, 2)
								) manifest(tag_id, spoiler_level)
								join public.unit_tag content_label
									on content_label.tag_id = manifest.tag_id
									and content_label.unit_id = ${post.id}
							), 0)`,
							contentNsfw: sql<boolean>`exists(
								select 1 from ${unitTag} content_label
								where content_label.unit_id = ${post.id}
									and content_label.tag_id = ${NsfwContentLabelId}::uuid
							)`,
						})
						.from(post)
						.innerJoin(unit, eq(unit.id, post.id))
						.leftJoin(postReply, eq(postReply.postId, post.id))
						.leftJoin(postReplyStat, eq(postReplyStat.postId, post.id))
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, post.id))
						.innerJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, post.id),
								eq(
									unitLocalization.language,
									resolvedUnitLocalizationLanguage(post.id, localizationLanguages),
								),
							),
						)
						.where(
							and(
								sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind)`,
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								isNull(unit.deletedAt),
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible' and rc.publication_state = 'active')`
									: undefined,
								query.subjectId ? eq(post.subjectUnitId, query.subjectId) : undefined,
							),
						)
						.orderBy(desc(unit.createdAt), desc(unit.id))
						.limit(query.limit ?? 20);
					const attributions = await getAttributionSummariesByUnitIds(
						rows.map(({ id }) => id),
						localizationLanguages,
					);
					const [viewerDisplayPreference] = identity.profile
						? await database
								.select({
									alwaysShowSpoilers: profilePreference.alwaysShowSpoilers,
									alwaysShowNsfw: profilePreference.alwaysShowNsfw,
								})
								.from(profilePreference)
								.where(eq(profilePreference.profileId, identity.profile.unitId))
								.limit(1)
						: [];
					return {
						items: rows.map((item) => {
							const contentSpoilerLevel = requireContentSpoilerLevel(item.contentSpoilerLevel);
							return {
								...item,
								realmId: query.realmId ?? null,
								attributions: attributions.get(item.id) ?? [],
								replyCount: toSafeInteger(item.replyCount, "reply count"),
								body:
									(item.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers) ||
									(item.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw)
										? null
										: toPortableTextResponse(item.body, "post.body"),
								summary:
									(item.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers) ||
									(item.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw)
										? null
										: item.summary,
								contentSpoiler: {
									level: contentSpoilerLevel,
									concealed:
										item.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers,
								},
								contentNsfw: {
									labelled: item.contentNsfw,
									concealed: item.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw,
								},
							};
						}),
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
					await authorization.realm.ensureUnitCreation(body.publishRealmIds, "realm.units.create");
					const subjectId = body.subjectId
						? await resolveCanonicalUnitId(database, body.subjectId)
						: undefined;
					if (subjectId) {
						await authorization.unit.ensureCanRead(subjectId);
					}
					const id = await runVoteTransaction(
						{ family: "unit_tag", authority: "global" },
						async (tx) => {
							if (subjectId)
								await authorization.entity.ensureSubjectAssociationAllowedIfEntity(tx, subjectId);
							const created = await insertUnit(tx, {
								kind: "post",
								status: "published",
								visibility: "public",
								publishedAt: new Date(),
								statusActor: { kind: "profile", profileId: profile.unitId },
							});
							await ensureSubjectPostTargetingAllowed(tx, {
								sourcePostId: created.id,
								subjectUnitId: subjectId,
								realmIds: body.publishRealmIds,
							});
							await tx.insert(post).values({
								id: created.id,
								kind: body.postKind,
								subjectUnitId: subjectId,
							});
							await tx.insert(unitLocalization).values({
								unitId: created.id,
								language: body.language,
								title: body.title ?? null,
								summary: body.summary ?? null,
								content: body.body,
								contentStatus: "published",
							});
							await applyNewPostTagMentionVotes(tx, {
								postId: created.id,
								profileId: profile.unitId,
								nextBody: body.body,
							});
							await replaceContentSpoilerLabel(tx, {
								postId: created.id,
								profileId: profile.unitId,
								level: body.contentSpoilerLevel ?? 0,
							});
							await replaceNsfwContentLabel(tx, {
								postId: created.id,
								profileId: profile.unitId,
								enabled: body.contentNsfw ?? false,
							});
							await tx.insert(unitOwnership).values({
								unitId: created.id,
								profileId: profile.unitId,
								assignedByProfileId: profile.unitId,
							});
							await createProfilePublisherAttribution(tx, {
								sourceUnitId: created.id,
								profileId: profile.unitId,
							});
							await publishPostToRealms(tx, {
								postId: created.id,
								realmIds: body.publishRealmIds,
								actorProfileId: profile.unitId,
							});
							await recordUnitRevision(tx, {
								unitId: created.id,
								actorProfileId: profile.unitId,
								contribution: body.revisionContext?.contribution,
								event: "create",
							});
							return created.id;
						},
					);
					return { id };
				},
				{
					access: "contribute:unit:create",
					body: CreatePostBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.BAD_REQUEST]: RevisionContributionBadRequestResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
							"PostTargetingLocked",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Create post or excerpt", tags: ["Posts"] },
				},
			)
			.post(
				"/wiki",
				async ({ profile, authorization, body }) => {
					await authorization.realm.ensureUnitCreation(body.publishRealmIds, "realm.units.create");
					const subjectId = body.subjectId
						? await resolveCanonicalUnitId(database, body.subjectId)
						: undefined;
					if (subjectId) await authorization.unit.ensureCanRead(subjectId);
					const id = await runVoteTransaction(
						{ family: "unit_tag", authority: "global" },
						async (tx) => {
							const created = await createWikiPost(tx, {
								profileId: profile.unitId,
								authorization,
								accessMode: body.accessMode,
								title: body.title,
								body: body.body,
								language: body.language,
								publishRealmIds: body.publishRealmIds,
								contribution: body.revisionContext?.contribution,
								...(subjectId ? { subjectId } : {}),
							});
							return created.id;
						},
					);
					return { id };
				},
				{
					access: "contribute:unit:create",
					body: CreateWikiBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.BAD_REQUEST]: RevisionContributionBadRequestResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"RealmCapabilityRequired",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"RealmRulesAcceptanceRequired",
							"PostTargetingLocked",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Create Wiki", tags: ["Posts"] },
				},
			)
			.get(
				"/:postId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const { authorization } = identity;
					const viewerProfileId = identity.profile?.unitId;
					const localizationLanguages = query.localizationLanguages ?? [];
					await authorization.unit.ensureCanRead(params.postId, () => new UnitNotFound("Post"));
					const [row] = await database
						.select({
							id: post.id,
							postKind: interactivePostKind,
							subjectId: post.subjectUnitId,
							rootPostId: postReply.rootPostId,
							parentPostId: postReply.parentPostId,
							replyCount,
							language: unitLocalization.language,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
							body: unitLocalization.content,
							latestRevisionId: unitRevisionHead.revisionId,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
							contentSpoilerLevel: sql<number>`coalesce((
								select manifest.spoiler_level
								from (values
									('019b76da-a800-7370-8000-000000000001'::uuid, 0),
									('019b76da-a800-7370-8000-000000000002'::uuid, 1),
									('019b76da-a800-7370-8000-000000000003'::uuid, 2)
								) manifest(tag_id, spoiler_level)
								join public.unit_tag content_label
									on content_label.tag_id = manifest.tag_id
									and content_label.unit_id = ${post.id}
							), 0)`,
							contentNsfw: sql<boolean>`exists(
								select 1 from ${unitTag} content_label
								where content_label.unit_id = ${post.id}
									and content_label.tag_id = ${NsfwContentLabelId}::uuid
							)`,
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
								eq(
									unitLocalization.language,
									resolvedUnitLocalizationLanguage(post.id, localizationLanguages),
								),
							),
						)
						.where(
							and(
								eq(post.id, params.postId),
								sql`${post.kind} in ('post'::post_kind, 'reply'::post_kind, 'excerpt'::post_kind, 'review'::post_kind, 'wiki'::post_kind, 'chapter'::post_kind)`,
								query.realmId
									? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${query.realmId} and rc.status = 'visible' and rc.publication_state = 'active')`
									: undefined,
							),
						)
						.limit(1);
					if (!row) throw new PostNotFound();
					if (!row.language) throw new PostLocalizationNotFound();
					if (row.postKind === "review" && !row.subjectId) throw new PostNotFound();
					const initialLocalization = {
						language: row.language,
						title: row.title,
						summary: row.summary,
						content: row.body,
						contentStatus: null,
					};
					const subjectId = row.subjectId;
					const subjectPromise = subjectId
						? authorization.unit
								.canRead(subjectId)
								.then((canRead) =>
									canRead ? getPostSubjectPresentation(subjectId, localizationLanguages) : null,
								)
						: Promise.resolve(null);
					const [
						localizationRows,
						attributionMap,
						scores,
						progressEntries,
						subject,
						canEdit,
						canManageAttributions,
						canManageRealmPublications,
						accessDecision,
						replyCreationDecision,
						targetingLock,
						canManageScores,
						viewerDisplayPreference,
					] = await Promise.all([
						database
							.select({
								language: unitLocalization.language,
								title: unitLocalization.title,
								summary: unitLocalization.summary,
								content: unitLocalization.content,
								contentStatus: unitLocalization.contentStatus,
							})
							.from(unitLocalization)
							.where(eq(unitLocalization.unitId, row.id))
							.orderBy(unitLocalization.position, unitLocalization.language),
						getAttributionSummariesByUnitIds([row.id], localizationLanguages),
						selectPostScores(row.id, viewerProfileId, localizationLanguages).then((items) =>
							items.map(({ scoreId, realmId, realmTitle, value }) => ({
								scoreId,
								realmId,
								realmTitle,
								value,
							})),
						),
						row.postKind === "review"
							? selectPostProgressEntry(row.id, viewerProfileId)
							: Promise.resolve([]),
						subjectPromise,
						authorization.unit.canUpdate(row.id, ["localizations"]),
						authorization.unit.canUpdate(row.id, ["credit-attributions"]),
						authorization.unit.decide(row.id, "unit.realm-publication.manage"),
						authorization.unit.decide(row.id, "unit.access.manage"),
						query.realmId
							? authorization.unit.decide(query.realmId, "realm.post.replies.create")
							: Promise.resolve({ allowed: true } as const),
						findPostTargetingLock(database, {
							targets:
								row.postKind === "reply" && row.rootPostId
									? [
											{ relation: "root", unitId: row.rootPostId },
											{ relation: "parent", unitId: row.id },
										]
									: [{ relation: "root", unitId: row.id }],
							...(query.realmId ? { realmId: query.realmId } : {}),
						}),
						row.postKind === "review"
							? authorization.unit.canUpdate(row.id, ["relations", "scores"])
							: Promise.resolve(false),
						viewerProfileId
							? database
									.select({
										alwaysShowSpoilers: profilePreference.alwaysShowSpoilers,
										alwaysShowNsfw: profilePreference.alwaysShowNsfw,
									})
									.from(profilePreference)
									.where(eq(profilePreference.profileId, viewerProfileId))
									.limit(1)
									.then(([value]) => value)
							: Promise.resolve(undefined),
					]);
					const chapterLocalization =
						row.postKind === "chapter"
							? selectReaderChapterLocalization(localizationRows, {
									bodyPresentation: canEdit ? "preview" : "published",
									localizationLanguages,
								})
							: undefined;
					if (row.postKind === "chapter" && !chapterLocalization)
						throw new PostLocalizationNotFound();
					const presentedLocalization = chapterLocalization ?? initialLocalization;
					const contentSpoilerLevel = requireContentSpoilerLevel(row.contentSpoilerLevel);
					const common = {
						id: row.id,
						language: presentedLocalization.language,
						availableLanguages: localizationRows.map(({ language }) => language),
						realmId: query.realmId ?? null,
						attributions: attributionMap.get(row.id) ?? [],
						title: presentedLocalization.title,
						summary: presentedLocalization.summary,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
						subject,
						scores,
						contentSpoiler: {
							level: contentSpoilerLevel,
							concealed:
								row.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers,
						},
						contentNsfw: {
							labelled: row.contentNsfw,
							concealed: row.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw,
						},
						replyCount: toSafeInteger(row.replyCount, "reply count"),
					};
					if (row.postKind === "chapter") {
						const content = chapterLocalization?.content ?? null;
						const canPresentContent =
							content !== null && (canEdit || chapterLocalization?.contentStatus === "published");
						return {
							...common,
							postKind: "chapter" as const,
							subjectId: row.subjectId,
							rootPostId: row.rootPostId,
							parentPostId: row.parentPostId,
							body: canPresentContent ? toPortableTextResponse(content, "post.body") : null,
							status: canPresentContent ? (chapterLocalization?.contentStatus ?? null) : null,
							latestRevisionId: row.latestRevisionId,
							capabilities: {
								canEdit,
								canManageAttributions,
								canManageRealmPublications: canManageRealmPublications.allowed,
								canManageAccess: accessDecision.allowed,
								canReply: replyCreationDecision.allowed && !targetingLock,
							},
						};
					}
					if (row.postKind === "review") {
						const targetId = row.subjectId;
						if (!targetId) throw new PostNotFound();
						return {
							...common,
							postKind: "review" as const,
							targetId,
							body: row.body === null ? null : toPortableTextResponse(row.body, "post.body"),
							latestRevisionId: row.latestRevisionId,
							progressEntry: progressEntries[0]
								? {
										unitId: progressEntries[0].unitId,
										entryKind: progressEntries[0].entryKind,
										status: progressEntries[0].status,
										progress: progressEntries[0].progress,
										completionDelta: progressEntries[0].completionDelta,
										occurredAt: progressEntries[0].occurredAt,
										datePrecision: progressEntries[0].datePrecision,
									}
								: null,
							capabilities: {
								canEdit,
								canManageAttributions,
								canManageRealmPublications: canManageRealmPublications.allowed,
								canManageAccess: accessDecision.allowed,
								canManageScores,
								canReply: replyCreationDecision.allowed && !targetingLock,
							},
						};
					}
					const threadDetail = {
						...common,
						subjectId: row.subjectId,
						rootPostId: row.rootPostId,
						parentPostId: row.parentPostId,
						body: toPortableTextResponse(row.body, "post.body"),
						latestRevisionId: row.latestRevisionId,
						capabilities: {
							canEdit,
							canManageAttributions,
							canManageRealmPublications: canManageRealmPublications.allowed,
							canManageAccess: accessDecision.allowed,
							canReply: replyCreationDecision.allowed && !targetingLock,
						},
					};
					if (row.postKind === "reply") return { ...threadDetail, postKind: "reply" as const };
					if (row.postKind === "excerpt") return { ...threadDetail, postKind: "excerpt" as const };
					if (row.postKind === "wiki") return { ...threadDetail, postKind: "wiki" as const };
					return { ...threadDetail, postKind: "post" as const };
				},
				{
					params: PostParams,
					query: GetPostQuery,
					response: {
						[StatusCodes.OK]: PostDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"PostLocalizationNotFound",
						]),
					},
					detail: { summary: "Get post", tags: ["Posts"] },
				},
			)
			.patch(
				"/:postId",
				async ({ params, profile, authorization, body }) => {
					await ensureSharedPostLocalizationTarget(params.postId);
					await authorization.unit.ensureCanUpdate(params.postId, [
						["localizations", body.language],
					]);
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
						const [current] = await tx
							.select({
								content: unitLocalization.content,
							})
							.from(unitLocalization)
							.where(
								and(
									eq(unitLocalization.unitId, params.postId),
									eq(unitLocalization.language, body.language),
								),
							)
							.for("update")
							.limit(1);
						await tx
							.insert(unitLocalization)
							.values({
								unitId: params.postId,
								language: body.language,
								title: body.title,
								summary: body.summary,
								content: body.body,
								contentStatus: "published",
							})
							.onConflictDoUpdate({
								target: [unitLocalization.unitId, unitLocalization.language],
								set: {
									title: body.title,
									summary: body.summary,
									content: body.body,
								},
							});
						await applyNewPostTagMentionVotes(tx, {
							postId: params.postId,
							profileId: profile.unitId,
							previousBody: current?.content,
							nextBody: body.body,
						});
						if (body.contentSpoilerLevel !== undefined)
							await replaceContentSpoilerLabel(tx, {
								postId: params.postId,
								profileId: profile.unitId,
								level: body.contentSpoilerLevel,
							});
						if (body.contentNsfw !== undefined)
							await replaceNsfwContentLabel(tx, {
								postId: params.postId,
								profileId: profile.unitId,
								enabled: body.contentNsfw,
							});
						await recordUnitRevision(tx, {
							unitId: params.postId,
							actorProfileId: profile.unitId,
							contribution: body.revisionContext?.contribution,
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
						[StatusCodes.BAD_REQUEST]: RevisionContributionBadRequestResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"PostNotFound",
							"PostLocalizationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitRevisionConflict",
							"PostTagMentionVoteConflict",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Update post", tags: ["Posts"] },
				},
			),
	)
	.group("/posts/:postId/replies", (app) =>
		app
			.get(
				"",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.postId, () => new UnitNotFound("Post"));
					await ensureRootPost(params.postId, query.realmId);
					const localizationLanguages = query.localizationLanguages ?? [];
					const selection = await selectReplyTree({
						rootPostId: params.postId,
						...(query.realmId ? { realmId: query.realmId } : {}),
						...(query.parentPostId ? { parentPostId: query.parentPostId } : {}),
						...(query.cursor ? { cursor: query.cursor } : {}),
						...(query.limit ? { limit: query.limit } : {}),
					});
					if (!selection.items.length) return { items: [], nextCursor: selection.nextCursor };
					const rows = await database
						.select(replySelection)
						.from(postReply)
						.innerJoin(post, eq(post.id, postReply.postId))
						.innerJoin(unit, eq(unit.id, postReply.postId))
						.innerJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, postReply.postId),
								eq(
									unitLocalization.language,
									resolvedUnitLocalizationLanguage(postReply.postId, localizationLanguages),
								),
							),
						)
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, postReply.postId))
						.where(
							inArray(
								postReply.postId,
								selection.items.map(({ postId }) => postId),
							),
						);
					const rowIds = rows.map(({ id }) => id);
					const [attributions, availableLanguageRows] = await Promise.all([
						getAttributionSummariesByUnitIds(rowIds, localizationLanguages),
						database
							.select({
								unitId: unitLocalization.unitId,
								language: unitLocalization.language,
							})
							.from(unitLocalization)
							.where(inArray(unitLocalization.unitId, rowIds))
							.orderBy(
								unitLocalization.unitId,
								unitLocalization.position,
								unitLocalization.language,
							),
					]);
					const availableLanguagesByUnitId = new Map<string, ContentLanguage[]>();
					for (const { unitId, language } of availableLanguageRows) {
						const languages = availableLanguagesByUnitId.get(unitId) ?? [];
						languages.push(language);
						availableLanguagesByUnitId.set(unitId, languages);
					}
					const lockedTargetIds = await getPostTargetingLockedUnitIds(database, {
						targetUnitIds: [params.postId, ...rows.map(({ id }) => id)],
						...(query.realmId ? { realmId: query.realmId } : {}),
					});
					const replyCreationAllowed = query.realmId
						? (await authorization.unit.decide(query.realmId, "realm.post.replies.create")).allowed
						: true;
					const rowById = new Map(rows.map((row) => [row.id, row]));
					return {
						items: await Promise.all(
							selection.items.map(async (selected) => {
								const row = rowById.get(selected.postId);
								if (!row) throw new Error(`Selected reply ${selected.postId} was not hydrated`);
								return {
									...toReplyResponse(
										row,
										attributions.get(row.id) ?? [],
										availableLanguagesByUnitId.get(row.id),
									),
									hasMoreChildren: selected.hasMoreChildren,
									childEndCursor: selected.childEndCursor,
									capabilities: {
										canEdit: await authorization.unit.canUpdate(row.id),
										canReply:
											replyCreationAllowed &&
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
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "PostNotFound"]),
					},
					detail: { summary: "List a bounded reply-post tree", tags: ["Posts"] },
				},
			)
			.post(
				"",
				async ({ params, profile, authorization, body }) => {
					await authorization.unit.ensureCanRead(params.postId, () => new UnitNotFound("Post"));
					await ensureRootPost(params.postId, body.realmId);
					await authorization.realm.ensureUnitCreation(
						body.realmId ? [body.realmId] : [],
						"realm.post.replies.create",
					);
					const createdReply = await runVoteTransaction(
						{ family: "unit_tag", authority: "global" },
						async (tx) => {
							const [root] = await tx
								.select({ id: post.id })
								.from(post)
								.where(and(eq(post.id, params.postId), ne(post.kind, "reply")))
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
												? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${postReply.postId} and rc.realm_id = ${body.realmId} and rc.status = 'visible' and rc.publication_state = 'active')`
												: undefined,
										),
									)
									.limit(1);
								if (!parent || parent.rootPostId !== params.postId) throw new ParentReplyNotFound();
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
							await applyNewPostTagMentionVotes(tx, {
								postId: created.id,
								profileId: profile.unitId,
								nextBody: body.body,
							});
							await tx.insert(unitOwnership).values({
								unitId: created.id,
								profileId: profile.unitId,
								assignedByProfileId: profile.unitId,
							});
							await createProfilePublisherAttribution(tx, {
								sourceUnitId: created.id,
								profileId: profile.unitId,
							});
							if (body.realmId)
								await publishPostToRealms(tx, {
									postId: created.id,
									realmIds: [body.realmId],
									actorProfileId: profile.unitId,
								});
							const revision = await recordUnitRevision(tx, {
								unitId: created.id,
								actorProfileId: profile.unitId,
								contribution: body.revisionContext?.contribution,
								event: "create",
							});
							const recipients = await tx
								.selectDistinct({ profileId: profileTable.id })
								.from(creditAttribution)
								.innerJoin(profileTable, eq(profileTable.id, creditAttribution.creditedUnitId))
								.where(eq(creditAttribution.sourceUnitId, recipientUnitId));
							for (const recipient of recipients) {
								if (!recipient.profileId || recipient.profileId === profile.unitId) continue;
								await createNotification(tx, {
									recipientProfileId: recipient.profileId,
									actorProfileId: profile.unitId,
									kind: "reply",
									subjectUnitId: created.id,
								});
							}
							return {
								id: created.id,
								language: body.language,
								rootPostId: params.postId,
								parentPostId: body.parentPostId ?? null,
								depth,
								body: body.body,
								moderationStatus: created.moderationStatus,
								deletedAt: created.deletedAt,
								latestRevisionId: revision.revisionId,
								createdAt: created.createdAt,
								updatedAt: created.updatedAt,
							};
						},
					);
					const [attributions, canEdit, lockedTargetIds] = await Promise.all([
						getAttributionSummariesByUnitIds([createdReply.id]),
						authorization.unit.canUpdate(createdReply.id),
						getPostTargetingLockedUnitIds(database, {
							targetUnitIds: [params.postId, createdReply.id],
							...(body.realmId ? { realmId: body.realmId } : {}),
						}),
					]);
					return {
						...toReplyResponse(createdReply, attributions.get(createdReply.id) ?? []),
						hasMoreChildren: false,
						childEndCursor: null,
						capabilities: {
							canEdit,
							canReply:
								!lockedTargetIds.has(params.postId) && !lockedTargetIds.has(createdReply.id),
						},
					};
				},
				{
					access: "contribute:interaction:write",
					params: RootPostParams,
					body: CreateReplyBody,
					response: {
						[StatusCodes.OK]: ReplyResponse,
						[StatusCodes.BAD_REQUEST]: RevisionContributionBadRequestResponse,
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
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Create reply post", tags: ["Posts"] },
				},
			)
			.patch(
				"/:replyPostId",
				async ({ params, profile, authorization, body }) => {
					await getReplyPost(params.postId, params.replyPostId);
					await authorization.unit.ensureCanUpdate(params.replyPostId, [
						["localizations", body.language],
					]);
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
						const [current] = await tx
							.select({ content: unitLocalization.content })
							.from(unitLocalization)
							.where(
								and(
									eq(unitLocalization.unitId, params.replyPostId),
									eq(unitLocalization.language, body.language),
								),
							)
							.for("update")
							.limit(1);
						await tx
							.insert(unitLocalization)
							.values({
								unitId: params.replyPostId,
								language: body.language,
								content: body.body,
								contentStatus: "published",
							})
							.onConflictDoUpdate({
								target: [unitLocalization.unitId, unitLocalization.language],
								set: { content: body.body },
							});
						await applyNewPostTagMentionVotes(tx, {
							postId: params.replyPostId,
							profileId: profile.unitId,
							previousBody: current?.content,
							nextBody: body.body,
						});
						await recordUnitRevision(tx, {
							unitId: params.replyPostId,
							actorProfileId: profile.unitId,
							contribution: body.revisionContext?.contribution,
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
						[StatusCodes.BAD_REQUEST]: RevisionContributionBadRequestResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ReplyPostNotFound", "UnitNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitRevisionConflict",
							"PostTagMentionVoteConflict",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Update reply post", tags: ["Posts"] },
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
				ne(post.kind, "reply"),
				isNull(unit.deletedAt),
				realmId
					? sql`exists(select 1 from realm_unit rc where rc.unit_id = ${post.id} and rc.realm_id = ${realmId} and rc.status = 'visible' and rc.publication_state = 'active')`
					: undefined,
			),
		)
		.limit(1);
	if (!row) throw new PostNotFound();
}

async function ensureSharedPostLocalizationTarget(postId: string) {
	const [row] = await database
		.select({ id: post.id, kind: post.kind })
		.from(post)
		.where(eq(post.id, postId))
		.limit(1);
	if (!row || !usesSharedPostLocalizationRoute(row.kind)) throw new PostNotFound();
}
