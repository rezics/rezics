import { and, desc, eq, gt, ne, or } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import type { UnitAuthorization } from "../authorization/unit/authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	profileBlock,
	profileRealmTagSubscription,
	unit,
	unitFollow,
	unitFollowNotificationPreference,
} from "../database/schema";
import type {
	FollowableUnitKind,
	NonRealmFollowableUnitKind,
	UnitKind,
} from "../database/schema/contract-values";
import {
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	type ContentRatingPolicy,
} from "../content-rating/policy";
import { UnitNotFound } from "../units/errors";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { presentAvatar } from "../units/avatar";
import { presentImageAsset } from "../units/service";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { acknowledgeCurrentRealmRulesOnFollow } from "../realms/service";
import { createNotification } from "../notifications/service";
import {
	decodeFollowingCursor,
	encodeFollowingCursor,
	type FollowingCursorBoundary,
} from "./cursor";
import { FollowingTargetKindMismatch, UserFollowBlocked, UserSelfFollowForbidden } from "./errors";

type FollowTarget = {
	readonly id: string;
	readonly kind: FollowableUnitKind;
};

type FollowAuthorization = Pick<UnitAuthorization<string>, "ensureCanRead">;

function requireFollowableUnitKind(kind: UnitKind): FollowableUnitKind {
	if (kind === "tag_path") throw new Error("Tag Path Units cannot enter generic Following");
	return kind;
}

type ReplaceFollowingSettings =
	| {
			readonly kind: "realm";
			readonly inAppNotificationsEnabled: boolean;
			readonly realmTagSourceSubscribed: boolean;
	  }
	| {
			readonly kind: NonRealmFollowableUnitKind;
			readonly inAppNotificationsEnabled: boolean;
			readonly realmTagSourceSubscribed: null;
	  };

type ListFollowingInput = {
	readonly followerProfileId: string;
	readonly kind?: FollowableUnitKind;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly cursor?: string;
	readonly limit: number;
	readonly contentRatingPolicy?: ContentRatingPolicy;
};

function followingCursorCondition(cursor: FollowingCursorBoundary | undefined) {
	if (!cursor) return undefined;
	const sameFavoriteAfterCursor = and(
		eq(unitFollow.favorite, cursor.favorite),
		or(
			gt(unitFollow.position, cursor.position),
			and(eq(unitFollow.position, cursor.position), gt(unitFollow.unitId, cursor.unitId)),
		),
	);
	return cursor.favorite
		? or(eq(unitFollow.favorite, false), sameFavoriteAfterCursor)
		: sameFavoriteAfterCursor;
}

export async function listFollowing(input: ListFollowingInput) {
	const localizationLanguages = input.localizationLanguages ?? [];
	const contentRatingPolicy = input.contentRatingPolicy ?? DefaultContentRatingPolicy;
	const cursor = decodeFollowingCursor(
		input.cursor,
		input.kind,
		localizationLanguages,
		contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
	);
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "cover", localizationLanguages),
			position: unitFollow.position,
			favorite: unitFollow.favorite,
			createdAt: unitFollow.createdAt,
			updatedAt: unitFollow.updatedAt,
		})
		.from(unitFollow)
		.innerJoin(unit, eq(unit.id, unitFollow.unitId))
		.where(
			and(
				eq(unitFollow.followerProfileId, input.followerProfileId),
				ne(unit.kind, "tag_path"),
				input.kind ? eq(unit.kind, input.kind) : undefined,
				getUnitReadCondition(input.followerProfileId),
				getContentRatingCondition(contentRatingPolicy),
				followingCursorCondition(cursor),
			),
		)
		.orderBy(desc(unitFollow.favorite), unitFollow.position, unitFollow.unitId)
		.limit(input.limit + 1);

	const items = rows.slice(0, input.limit);
	const last = items.at(-1);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(items.map((item) => item.id));
	return {
		items: items.map(({ avatar, coverAssetId, ...record }) => ({
			...record,
			kind: requireFollowableUnitKind(record.kind),
			slugAddress: slugAddresses.get(record.id) ?? null,
			avatar: presentAvatar(avatar),
			cover: presentImageAsset(coverAssetId, "cover"),
		})),
		nextCursor:
			rows.length > input.limit && last
				? encodeFollowingCursor(
						input.kind,
						localizationLanguages,
						contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
						{
							favorite: last.favorite,
							position: last.position,
							unitId: last.id,
						},
					)
				: null,
	};
}

async function resolveFollowTarget(
	unitId: string,
	authorization: FollowAuthorization,
): Promise<FollowTarget> {
	await authorization.ensureCanRead(unitId, () => new UnitNotFound());
	const [target] = await database
		.select({
			id: unit.id,
			kind: unit.kind,
		})
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!target) throw new UnitNotFound();
	if (target.kind === "tag_path") throw new UnitNotFound();
	return { id: target.id, kind: target.kind };
}

export async function followUnit(input: {
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	if (target.id === input.followerProfileId) throw new UserSelfFollowForbidden();

	await database.transaction(async (tx) => {
		if (target.kind === "profile") {
			const [blocked] = await tx
				.select({ id: profileBlock.blockedProfileId })
				.from(profileBlock)
				.where(
					or(
						and(
							eq(profileBlock.blockerProfileId, input.followerProfileId),
							eq(profileBlock.blockedProfileId, target.id),
						),
						and(
							eq(profileBlock.blockerProfileId, target.id),
							eq(profileBlock.blockedProfileId, input.followerProfileId),
						),
					),
				)
				.limit(1);
			if (blocked) throw new UserFollowBlocked();
		}

		const [created] = await tx
			.insert(unitFollow)
			.values({ followerProfileId: input.followerProfileId, unitId: target.id })
			.onConflictDoNothing()
			.returning({ unitId: unitFollow.unitId });
		if (created && target.kind === "profile")
			await createNotification(tx, {
				kind: "new_follower",
				recipientProfileId: target.id,
				actorProfileId: input.followerProfileId,
				dedupeKey: `new-follower:${input.followerProfileId}:${target.id}`,
			});
		if (target.kind === "realm")
			await acknowledgeCurrentRealmRulesOnFollow(tx, target.id, input.followerProfileId);
	});
	return { following: true as const };
}

export async function unfollowUnit(followerProfileId: string, unitId: string) {
	await database
		.delete(unitFollow)
		.where(and(eq(unitFollow.followerProfileId, followerProfileId), eq(unitFollow.unitId, unitId)));
	return { following: false as const };
}

export async function getFollowingStatus(input: {
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	const [record] = await database
		.select({
			favorite: unitFollow.favorite,
			position: unitFollow.position,
			inAppNotificationsEnabled: unitFollowNotificationPreference.inApp,
		})
		.from(unitFollow)
		.leftJoin(
			unitFollowNotificationPreference,
			and(
				eq(unitFollowNotificationPreference.followerProfileId, unitFollow.followerProfileId),
				eq(unitFollowNotificationPreference.unitId, unitFollow.unitId),
			),
		)
		.where(
			and(
				eq(unitFollow.followerProfileId, input.followerProfileId),
				eq(unitFollow.unitId, target.id),
			),
		)
		.limit(1);
	if (target.kind === "realm") {
		const realmTagSourceSubscribed = Boolean(
			(
				await database
					.select({ realmId: profileRealmTagSubscription.realmId })
					.from(profileRealmTagSubscription)
					.where(
						and(
							eq(profileRealmTagSubscription.profileId, input.followerProfileId),
							eq(profileRealmTagSubscription.realmId, target.id),
						),
					)
					.limit(1)
			)[0],
		);
		if (!record)
			return {
				following: false as const,
				kind: target.kind,
				favorite: null,
				position: null,
				inAppNotificationsEnabled: null,
				realmTagSourceSubscribed,
			};
		return {
			following: true as const,
			kind: target.kind,
			favorite: record.favorite,
			position: record.position,
			inAppNotificationsEnabled: record.inAppNotificationsEnabled ?? true,
			realmTagSourceSubscribed,
		};
	}
	if (!record)
		return {
			following: false as const,
			kind: target.kind,
			favorite: null,
			position: null,
			inAppNotificationsEnabled: null,
			realmTagSourceSubscribed: null,
		};
	return {
		following: true as const,
		kind: target.kind,
		favorite: record.favorite,
		position: record.position,
		inAppNotificationsEnabled: record.inAppNotificationsEnabled ?? true,
		realmTagSourceSubscribed: null,
	};
}

export async function replaceFollowingSettings(input: {
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
	readonly settings: ReplaceFollowingSettings;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	if (target.kind !== input.settings.kind) throw new FollowingTargetKindMismatch();

	const follow = await database.transaction(async (tx) => {
		const [record] = await tx
			.select({ favorite: unitFollow.favorite, position: unitFollow.position })
			.from(unitFollow)
			.where(
				and(
					eq(unitFollow.followerProfileId, input.followerProfileId),
					eq(unitFollow.unitId, target.id),
				),
			)
			.limit(1);
		if (!record) throw new UnitNotFound("Follow");

		await tx
			.insert(unitFollowNotificationPreference)
			.values({
				followerProfileId: input.followerProfileId,
				unitId: target.id,
				inApp: input.settings.inAppNotificationsEnabled,
			})
			.onConflictDoUpdate({
				target: [
					unitFollowNotificationPreference.followerProfileId,
					unitFollowNotificationPreference.unitId,
				],
				set: {
					inApp: input.settings.inAppNotificationsEnabled,
					updatedAt: new Date(),
				},
			});

		if (input.settings.kind === "realm") {
			if (input.settings.realmTagSourceSubscribed)
				await tx
					.insert(profileRealmTagSubscription)
					.values({
						profileId: input.followerProfileId,
						realmId: target.id,
					})
					.onConflictDoNothing();
			else
				await tx
					.delete(profileRealmTagSubscription)
					.where(
						and(
							eq(profileRealmTagSubscription.profileId, input.followerProfileId),
							eq(profileRealmTagSubscription.realmId, target.id),
						),
					);
		}
		return record;
	});

	if (input.settings.kind === "realm")
		return {
			following: true as const,
			kind: input.settings.kind,
			favorite: follow.favorite,
			position: follow.position,
			inAppNotificationsEnabled: input.settings.inAppNotificationsEnabled,
			realmTagSourceSubscribed: input.settings.realmTagSourceSubscribed,
		};
	return {
		following: true as const,
		kind: input.settings.kind,
		favorite: follow.favorite,
		position: follow.position,
		inAppNotificationsEnabled: input.settings.inAppNotificationsEnabled,
		realmTagSourceSubscribed: null,
	};
}

export async function updateFollowingPresentation(
	followerProfileId: string,
	unitId: string,
	input: { readonly favorite?: boolean; readonly position?: string },
) {
	const [updated] = await database
		.update(unitFollow)
		.set({
			...(input.favorite === undefined ? {} : { favorite: input.favorite }),
			...(input.position === undefined ? {} : { position: input.position }),
			updatedAt: new Date(),
		})
		.where(and(eq(unitFollow.followerProfileId, followerProfileId), eq(unitFollow.unitId, unitId)))
		.returning({
			unitId: unitFollow.unitId,
			position: unitFollow.position,
			favorite: unitFollow.favorite,
			updatedAt: unitFollow.updatedAt,
		});
	if (!updated) throw new UnitNotFound("Follow");
	return updated;
}
