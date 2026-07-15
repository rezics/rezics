import { StatusCodes } from "http-status-codes";
import { and, eq, or } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	unit,
	profile as profileTable,
	profileBlock,
	profileFollow,
	profilePreference,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { storage } from "../../storage";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { BlockResponse, FollowResponse, UserBlockListResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CurrentProfileResponse,
	PreferencesResponse,
	PublicProfileResponse,
} from "../schema/response";
import {
	ReplacePreferencesBody,
	UpdateProfileBody,
	UserIdParams,
	UserLookupParams,
} from "./schema";
import { getProfile, presentProfile, PublicProfileSelection } from "./service";
import {
	PreferencesNotFound,
	ProfileChanged,
	ProfileNotFound,
	UserFollowBlocked,
	UserNotFound,
	UserSelfBlockForbidden,
	UserSelfFollowForbidden,
} from "./errors";

const ProfileNotFoundResponse = toApiErrorResponse(["ProfileNotFound"]);
const UnitForbiddenResponse = toApiErrorResponse(["UnitFieldLocked", "UploadKeyForbidden"]);
const UserNotFoundResponse = toApiErrorResponse(["UnitNotFound", "UserNotFound"]);

export default new Elysia({ prefix: "/users" })
	.use(session)
	.get(
		"/me",
		async ({ profile, user }) => {
			return {
				...(await getProfile(profile.unitId)),
				email: user.email,
				emailVerified: user.emailVerified,
				onboarding: user.emailVerified ? "complete" : "verify_email",
			};
		},
		{
			auth: true,
			response: {
				[StatusCodes.OK]: CurrentProfileResponse,
				[StatusCodes.NOT_FOUND]: ProfileNotFoundResponse,
			},
			detail: { summary: "Current user profile", tags: ["Users"] },
		},
	)
	.patch(
		"/me",
		async ({ profile, authorization, body }) => {
			if (body.avatar !== undefined) authorization.upload.ensureOwn(body.avatar);
			await authorization.unit.ensureFieldsUnlocked(profile.unitId, [
				"/unit/slug",
				"/profile",
			]);
			const previousAvatar = await database.transaction(async (tx) => {
				const [current] = await tx
					.select({ avatar: profileTable.avatar })
					.from(profileTable)
					.where(eq(profileTable.id, profile.unitId))
					.limit(1);
				if (!current) throw new ProfileNotFound();
				const [updated] = await tx
					.update(unit)
					.set(body.slug === undefined ? { updatedAt: new Date() } : { slug: body.slug })
					.where(
						and(
							eq(unit.id, profile.unitId),
							eq(unit.kind, "profile"),
							eq(unit.updatedAt, new Date(body.updatedAt)),
						),
					)
					.returning({ id: unit.id });
				if (!updated) {
					const [latest] = await tx
						.select({ updatedAt: unit.updatedAt })
						.from(unit)
						.where(eq(unit.id, profile.unitId))
						.limit(1);
					if (!latest) throw new ProfileNotFound();
					throw new ProfileChanged(latest.updatedAt);
				}
				await tx
					.update(profileTable)
					.set({
						name: body.name,
						avatar: body.avatar,
						summary: body.summary,
						description: body.description,
					})
					.where(eq(profileTable.id, profile.unitId));
				await recordUnitRevision(tx, {
					unitId: profile.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return current.avatar;
			});
			if (
				body.avatar !== undefined &&
				previousAvatar !== null &&
				authorization.upload.owns(previousAvatar) &&
				previousAvatar !== body.avatar
			)
				await storage.delete({ Key: previousAvatar });
			return getProfile(profile.unitId);
		},
		{
			write: true,
			body: UpdateProfileBody,
			response: {
				[StatusCodes.OK]: PublicProfileResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProfileNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ProfileChanged"]),
			},
			detail: { summary: "Update current profile", tags: ["Users"] },
		},
	)
	.get(
		"/me/preferences",
		async ({ profile }) => {
			const [preference] = await database
				.select()
				.from(profilePreference)
				.where(eq(profilePreference.profileId, profile.unitId))
				.limit(1);
			if (!preference) throw new PreferencesNotFound();
			return {
				profileId: preference.profileId,
				defaultLicense: preference.defaultLicense,
				defaultRealmManageMode: preference.defaultRealmManageMode,
				collectionConfig: preference.collectionConfig,
				personalizedFeed: preference.personalizedFeed,
				contentRatings: preference.contentRatings,
				preferredLanguages: preference.preferredLanguages,
			};
		},
		{
			auth: true,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Current user preferences", tags: ["Users"] },
		},
	)
	.put(
		"/me/preferences",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureFieldsUnlocked(profile.unitId, ["/preferences"]);
			await database.transaction(async (tx) => {
				const [preference] = await tx
					.update(profilePreference)
					.set({
						defaultLicense: body.defaultLicense,
						defaultRealmManageMode: body.defaultRealmManageMode,
						collectionConfig: body.collectionConfig,
						personalizedFeed: body.personalizedFeed,
						contentRatings: body.contentRatings,
						preferredLanguages: body.preferredLanguages,
					})
					.where(eq(profilePreference.profileId, profile.unitId))
					.returning({ profileId: profilePreference.profileId });
				if (!preference) throw new PreferencesNotFound();
			});
			return {
				profileId: profile.unitId,
				...body,
			};
		},
		{
			write: true,
			body: ReplacePreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitFieldLocked"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Replace current user preferences", tags: ["Users"] },
		},
	)
	.get(
		"/:id",
		async ({ params, request }) => {
			const [result] = await database
				.select(PublicProfileSelection)
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.where(
					and(
						eq(unit.id, params.id),
						eq(unit.kind, "profile"),
						eq(unit.status, "published"),
						eq(unit.visibility, "public"),
					),
				)
				.limit(1);
			if (!result) throw new UserNotFound();
			const viewer = (await resolveIdentity(request.headers)).profile;
			const following = viewer
				? Boolean(
						(
							await database
								.select({ id: profileFollow.followedProfileId })
								.from(profileFollow)
								.where(
									and(
										eq(profileFollow.followerProfileId, viewer.unitId),
										eq(profileFollow.followedProfileId, result.id),
									),
								)
								.limit(1)
						)[0],
					)
				: false;
			return { ...(await presentProfile(result)), viewerFollowing: following };
		},
		{
			params: UserLookupParams,
			response: {
				[StatusCodes.OK]: PublicProfileResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Public user profile", tags: ["Users"] },
		},
	)
	.put(
		"/:id/follow",
		async ({ profile, authorization, params }) => {
			if (params.id === profile.unitId) throw new UserSelfFollowForbidden();
			await authorization.unit.ensureCanRead(params.id, () => new UnitNotFound("User"));
			const [target] = await database
				.select({ id: unit.id })
				.from(unit)
				.where(and(eq(unit.id, params.id), eq(unit.kind, "profile")))
				.limit(1);
			if (!target) throw new UserNotFound();
			const [blocked] = await database
				.select({ id: profileBlock.blockedProfileId })
				.from(profileBlock)
				.where(
					or(
						and(
							eq(profileBlock.blockerProfileId, profile.unitId),
							eq(profileBlock.blockedProfileId, params.id),
						),
						and(
							eq(profileBlock.blockerProfileId, params.id),
							eq(profileBlock.blockedProfileId, profile.unitId),
						),
					),
				)
				.limit(1);
			if (blocked) throw new UserFollowBlocked();
			const notificationId = await database.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(profileFollow)
					.values({ followerProfileId: profile.unitId, followedProfileId: params.id })
					.onConflictDoNothing()
					.returning({ id: profileFollow.followedProfileId });
				if (!inserted) return undefined;
				return createNotification(tx, {
					recipientProfileId: params.id,
					actorProfileId: profile.unitId,
					kind: "follow",
					subjectUnitId: profile.unitId,
					dedupeKey: `follow:${profile.unitId}`,
				});
			});
			await deliverNotificationEmail(notificationId);
			return { following: true };
		},
		{
			contribute: true,
			params: UserIdParams,
			response: {
				[StatusCodes.OK]: FollowResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UserSelfFollowForbidden",
					"UserFollowBlocked",
				]),
			},
			detail: { summary: "Follow user", tags: ["Users"] },
		},
	)
	.delete(
		"/:id/follow",
		async ({ profile, params }) => {
			await database
				.delete(profileFollow)
				.where(
					and(
						eq(profileFollow.followerProfileId, profile.unitId),
						eq(profileFollow.followedProfileId, params.id),
					),
				);
			return { following: false };
		},
		{
			write: true,
			params: UserIdParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow user", tags: ["Users"] },
		},
	)
	.get(
		"/me/blocks",
		async ({ profile }) => ({
			items: await database
				.select({
					userId: profileBlock.blockedProfileId,
					name: profileTable.name,
					createdAt: profileBlock.createdAt,
				})
				.from(profileBlock)
				.innerJoin(profileTable, eq(profileTable.id, profileBlock.blockedProfileId))
				.where(eq(profileBlock.blockerProfileId, profile.unitId))
				.orderBy(profileBlock.createdAt, profileBlock.blockedProfileId),
		}),
		{
			auth: true,
			response: { [StatusCodes.OK]: UserBlockListResponse },
			detail: { summary: "List blocked users", tags: ["Users"] },
		},
	)
	.put(
		"/:id/block",
		async ({ profile, authorization, params }) => {
			if (params.id === profile.unitId) throw new UserSelfBlockForbidden();
			await authorization.unit.ensureCanRead(params.id, () => new UnitNotFound("User"));
			await database.transaction(async (tx) => {
				await tx
					.insert(profileBlock)
					.values({ blockerProfileId: profile.unitId, blockedProfileId: params.id })
					.onConflictDoNothing();
				await tx
					.delete(profileFollow)
					.where(
						or(
							and(
								eq(profileFollow.followerProfileId, profile.unitId),
								eq(profileFollow.followedProfileId, params.id),
							),
							and(
								eq(profileFollow.followerProfileId, params.id),
								eq(profileFollow.followedProfileId, profile.unitId),
							),
						),
					);
			});
			return { blocked: true };
		},
		{
			write: true,
			params: UserIdParams,
			response: {
				[StatusCodes.OK]: BlockResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UserSelfBlockForbidden"]),
			},
			detail: { summary: "Block user", tags: ["Users"] },
		},
	)
	.delete(
		"/:id/block",
		async ({ profile, params }) => {
			await database.transaction(async (tx) => {
				await tx
					.delete(profileBlock)
					.where(
						and(
							eq(profileBlock.blockerProfileId, profile.unitId),
							eq(profileBlock.blockedProfileId, params.id),
						),
					);
			});
			return { blocked: false };
		},
		{
			write: true,
			params: UserIdParams,
			response: { [StatusCodes.OK]: BlockResponse },
			detail: { summary: "Unblock user", tags: ["Users"] },
		},
	);
