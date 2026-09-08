import {presentImageAsset} from "../api/image-assets/presentation";
import type { ContentLanguage } from "@rezics/i18n";
import { and, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import type { UnitAuthorization } from "../authorization/unit/authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import {
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	type ContentRatingPolicy,
} from "../content-rating/policy";
import { database, type DatabaseTransaction } from "../database";
import {
	accountEntityBlock,
	accountRealmTagSubscription,
	unit,
	unitFollow,
	accountFollowPreference,
} from "../database/schema";
import type {
	FollowableUnitKind,
	NonRealmFollowableUnitKind,
	UnitKind,
} from "../database/schema/contract-values";
import { users } from "../database/schema/auth";
import { authEntity } from "../database/schema/participation";
import { ParticipationDenied } from "../participation/policy";
import { createNotification } from "../notifications/service";
import { acknowledgeCurrentRealmRulesOnFollow } from "../realms/service";
import { presentAvatar } from "../units/avatar";
import { UnitNotFound } from "../units/errors";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../units/localization";

import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
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
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly kind?: FollowableUnitKind;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly cursor?: string;
	readonly limit: number;
	readonly contentRatingPolicy?: ContentRatingPolicy;
};

async function lockFollowingAccount(tx: DatabaseTransaction, authUserId: string, entityId: string) {
	const [account] = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, authUserId), isNull(users.erasedAt)))
		.limit(1)
		.for("share");
	if (!account) throw new ParticipationDenied("Account is unavailable");
	const [binding] = await tx
		.select({ id: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, entityId),
				eq(authEntity.state, "active"),
			),
		)
		.limit(1)
		.for("share");
	if (!binding)
		throw new ParticipationDenied("Personal Following requires the account's self identity");
}

function followingCursorCondition(cursor: FollowingCursorBoundary | undefined) {
	if (!cursor) return undefined;
	const sameFavoriteAfterCursor = and(
		eq(accountFollowPreference.favorite, cursor.favorite),
		or(
			gt(accountFollowPreference.position, cursor.position),
			and(
				eq(accountFollowPreference.position, cursor.position),
				gt(accountFollowPreference.unitId, cursor.unitId),
			),
		),
	);
	return cursor.favorite
		? or(eq(accountFollowPreference.favorite, false), sameFavoriteAfterCursor)
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
	const scan = await database.transaction(async (tx) => {
		await lockFollowingAccount(tx, input.authUserId, input.followerProfileId);
		if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100)
			throw new RangeError("Following page limit must be between 1 and 100");
		const candidates = await tx
			.select({
				unitId: accountFollowPreference.unitId,
				favorite: accountFollowPreference.favorite,
				position: accountFollowPreference.position,
			})
			.from(accountFollowPreference)
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					followingCursorCondition(cursor),
				),
			)
			.orderBy(
				desc(accountFollowPreference.favorite),
				accountFollowPreference.position,
				accountFollowPreference.unitId,
			)
			.limit(512);
		if (!candidates.length) return { rows: [], lastScanned: undefined, exhausted: true };

		const rows = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
				language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
				title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
				avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
				coverAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "cover", localizationLanguages),
				position: accountFollowPreference.position,
				favorite: accountFollowPreference.favorite,
				createdAt: accountFollowPreference.createdAt,
				updatedAt: accountFollowPreference.updatedAt,
			})
			.from(accountFollowPreference)
			.innerJoin(unit, eq(unit.id, accountFollowPreference.unitId))
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					ne(unit.kind, "tag_path"),
					input.kind ? eq(unit.kind, input.kind) : undefined,
					getUnitReadCondition(input.followerProfileId),
					getContentRatingCondition(contentRatingPolicy),
					inArray(
						accountFollowPreference.unitId,
						candidates.map((item) => item.unitId),
					),
				),
			)
			.orderBy(
				desc(accountFollowPreference.favorite),
				accountFollowPreference.position,
				accountFollowPreference.unitId,
			)
			.limit(input.limit + 1);

		return { rows, lastScanned: candidates.at(-1), exhausted: candidates.length < 512 };
	});
	const rows = scan.rows;
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
						{ favorite: last.favorite, position: last.position, unitId: last.id },
					)
				: !scan.exhausted && scan.lastScanned
					? encodeFollowingCursor(
							input.kind,
							localizationLanguages,
							contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
							scan.lastScanned,
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
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	if (target.id === input.followerProfileId) throw new UserSelfFollowForbidden();

	await database.transaction(async (tx) => {
		await lockFollowingAccount(tx, input.authUserId, input.followerProfileId);
		if (target.kind === "entity") {
			const [blocked] = await tx
				.select({ id: accountEntityBlock.blockedEntityId })
				.from(accountEntityBlock)
				.where(
					or(
						and(
							eq(
								accountEntityBlock.blockerAuthUserId,
								selfAuthUserIdForEntity(input.followerProfileId),
							),
							eq(accountEntityBlock.blockedEntityId, target.id),
						),
						and(
							eq(accountEntityBlock.blockerAuthUserId, selfAuthUserIdForEntity(target.id)),
							eq(accountEntityBlock.blockedEntityId, input.followerProfileId),
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
		await tx
			.insert(accountFollowPreference)
			.values({
				authUserId: input.authUserId,
				followerEntityId: input.followerProfileId,
				unitId: target.id,
			})
			.onConflictDoNothing();
		if (created && target.kind === "entity")
			await createNotification(tx, {
				kind: "new_follower",
				recipientEntityId: target.id,
				actorProfileId: input.followerProfileId,
				dedupeKey: `new-follower:${input.followerProfileId}:${target.id}`,
			});
		if (target.kind === "realm")
			await acknowledgeCurrentRealmRulesOnFollow(tx, target.id, input.followerProfileId);
	});
	return { following: true as const };
}

export async function unfollowUnit(authUserId: string, followerProfileId: string, unitId: string) {
	await database.transaction(async (tx) => {
		await lockFollowingAccount(tx, authUserId, followerProfileId);
		await tx
			.delete(unitFollow)
			.where(
				and(eq(unitFollow.followerProfileId, followerProfileId), eq(unitFollow.unitId, unitId)),
			);
	});
	return { following: false as const };
}

export async function getFollowingStatus(input: {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	return database.transaction(async (tx) => {
		await lockFollowingAccount(tx, input.authUserId, input.followerProfileId);
		const [record] = await tx
			.select({
				favorite: accountFollowPreference.favorite,
				position: accountFollowPreference.position,
				inAppNotificationsEnabled: accountFollowPreference.inApp,
			})
			.from(accountFollowPreference)
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					eq(accountFollowPreference.unitId, target.id),
				),
			)
			.limit(1);
		if (target.kind === "realm") {
			const realmTagSourceSubscribed = Boolean(
				(
					await tx
						.select({ realmId: accountRealmTagSubscription.realmId })
						.from(accountRealmTagSubscription)
						.where(
							and(
								eq(accountRealmTagSubscription.authUserId, input.authUserId),
								eq(accountRealmTagSubscription.realmId, target.id),
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
	});
}

export async function replaceFollowingSettings(input: {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
	readonly settings: ReplaceFollowingSettings;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	if (target.kind !== input.settings.kind) throw new FollowingTargetKindMismatch();

	const follow = await database.transaction(async (tx) => {
		await lockFollowingAccount(tx, input.authUserId, input.followerProfileId);
		const [record] = await tx
			.select({
				favorite: accountFollowPreference.favorite,
				position: accountFollowPreference.position,
			})
			.from(accountFollowPreference)
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					eq(accountFollowPreference.unitId, target.id),
				),
			)
			.limit(1);
		if (!record) throw new UnitNotFound("Follow");

		await tx
			.insert(accountFollowPreference)
			.values({
				authUserId: input.authUserId,
				followerEntityId: input.followerProfileId,
				unitId: target.id,
				inApp: input.settings.inAppNotificationsEnabled,
			})
			.onConflictDoUpdate({
				target: [accountFollowPreference.authUserId, accountFollowPreference.unitId],
				set: {
					inApp: input.settings.inAppNotificationsEnabled,
					updatedAt: new Date(),
				},
			});

		if (input.settings.kind === "realm") {
			if (input.settings.realmTagSourceSubscribed)
				await tx
					.insert(accountRealmTagSubscription)
					.values({
						authUserId: input.authUserId,
						realmId: target.id,
					})
					.onConflictDoNothing();
			else
				await tx
					.delete(accountRealmTagSubscription)
					.where(
						and(
							eq(accountRealmTagSubscription.authUserId, input.authUserId),
							eq(accountRealmTagSubscription.realmId, target.id),
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
	authUserId: string,
	followerProfileId: string,
	unitId: string,
	input: { readonly favorite?: boolean; readonly position?: string },
) {
	return database.transaction(async (tx) => {
		await lockFollowingAccount(tx, authUserId, followerProfileId);
		const [updated] = await tx
			.update(accountFollowPreference)
			.set({
				...(input.favorite === undefined ? {} : { favorite: input.favorite }),
				...(input.position === undefined ? {} : { position: input.position }),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(accountFollowPreference.authUserId, authUserId),
					eq(accountFollowPreference.unitId, unitId),
				),
			)
			.returning({
				unitId: accountFollowPreference.unitId,
				position: accountFollowPreference.position,
				favorite: accountFollowPreference.favorite,
				updatedAt: accountFollowPreference.updatedAt,
			});
		if (!updated) throw new UnitNotFound("Follow");
		return updated;
	});
}
