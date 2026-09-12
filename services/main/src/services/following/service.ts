import { presentImageAsset } from "../api/image-assets/presentation";
import type { ContentLanguage } from "@rezics/i18n";
import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { referenceValue } from "../database/schema/reference-value";
import {
	allocateReferenceValue,
	findReferenceValueByNativeId,
	referenceValueTarget,
} from "../units/reference-value";
import { resolveRegisteredUnitReference } from "../units/reference";
import type { Authorization } from "../authorization";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import type { UnitAuthorization } from "../authorization/unit/authorization";
import { unitStateRelation } from "../units/state-relation";
import { readUnitStateById } from "../units/query";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import type { UnitOwner } from "@rezics/reference";
import {
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	type ContentRatingPolicy,
} from "../content-rating/policy";
import { database, type DatabaseTransaction } from "../database";
import {
	accountEntityBlock,
	accountRealmTagSubscription,
	unitFollow,
	unitMergeRedirect,
	accountFollowPreference,
} from "../database/schema";
import type {
	FollowableUnitOwner,
	NonRealmFollowableUnitOwner,
} from "../database/schema/contract-values";
import { users } from "../database/schema/auth";
import { authEntity } from "../database/schema/participation";
import { ParticipationDenied } from "../participation/policy";
import { createNotification } from "../notifications/service";
import { acknowledgeCurrentRealmRulesOnFollow } from "../realms/service";
import { UnitNotFound } from "../units/errors";
import { resolvedUnitLocalizationImageAssetId } from "../units/localization";

import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import {
	decodeFollowingCursor,
	encodeFollowingCursor,
	type FollowingCursorBoundary,
} from "./cursor";
import { FollowingTargetKindMismatch, UserFollowBlocked, UserSelfFollowForbidden } from "./errors";

type FollowTarget = {
	readonly id: string;
	readonly owner: FollowableUnitOwner;
};

type FollowAuthorization = Pick<
	Authorization<string>,
	"profileId" | "authUserId" | "participationAuthority" | "account"
> & {
	readonly unit: Pick<
		UnitAuthorization<string>,
		"decideInTransaction" | "readableUnitIdsInTransaction"
	>;
};

function requireFollowableUnitOwner(owner: UnitOwner): FollowableUnitOwner {
	if (owner === "tag_path") throw new Error("Tag Path Units cannot enter generic Following");
	return owner;
}

type ReplaceFollowingSettings =
	| {
			readonly owner: "realm";
			readonly inAppNotificationsEnabled: boolean;
			readonly realmTagSourceSubscribed: boolean;
	  }
	| {
			readonly owner: NonRealmFollowableUnitOwner;
			readonly inAppNotificationsEnabled: boolean;
			readonly realmTagSourceSubscribed: null;
	  };

type ListFollowingInput = {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly authorization: FollowAuthorization;
	readonly owner?: FollowableUnitOwner;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly cursor?: string;
	readonly limit: number;
	readonly contentRatingPolicy?: ContentRatingPolicy;
};

async function lockFollowingAccount(
	tx: DatabaseTransaction,
	authUserId: string,
	entityId: string,
	authorization: FollowAuthorization,
	action: "read" | "write" | "contribute",
) {
	const authority = authorization.participationAuthority;
	if (
		authorization.authUserId !== authUserId ||
		authorization.profileId !== entityId ||
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.principal.authUserId !== authUserId
	)
		throw new ParticipationDenied("Following requires the current account's self authority");
	const [account] = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, authUserId), eq(users.principalKind, "human"), isNull(users.erasedAt)))
		.limit(1)
		.for("share");
	if (!account) throw new ParticipationDenied("Account is unavailable");
	await ensureAccountAuthenticationAllowed(authUserId, tx);
	if (action === "write") await authorization.account.ensureCanWrite(tx);
	if (action === "contribute") await authorization.account.ensureCanContribute(tx);
	const [binding] = await tx
		.select({ id: authEntity.entityId })
		.from(authEntity)
		.where(
			and(
				eq(authEntity.authUserId, authUserId),
				eq(authEntity.entityId, entityId),
				eq(authEntity.state, "active"),
				eq(authEntity.revision, authority.authorizationRevision),
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
				gt(accountFollowPreference.targetReferenceId, cursor.targetReferenceId),
			),
		),
	);
	return cursor.favorite
		? or(eq(accountFollowPreference.favorite, false), sameFavoriteAfterCursor)
		: sameFavoriteAfterCursor;
}

/** Read a bounded page of the current account's choices with current target disclosure. @internal */
export async function listFollowing(input: ListFollowingInput) {
	const localizationLanguages = input.localizationLanguages ?? [];
	const contentRatingPolicy = input.contentRatingPolicy ?? DefaultContentRatingPolicy;
	const cursor = decodeFollowingCursor(
		input.cursor,
		input.owner,
		localizationLanguages,
		contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
	);
	const scan = await database.transaction(async (tx) => {
		await lockFollowingAccount(
			tx,
			input.authUserId,
			input.followerProfileId,
			input.authorization,
			"read",
		);
		if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100)
			throw new RangeError("Following page limit must be between 1 and 100");
		const candidates = await tx
			.select({
				unitId: sql<string>`${referenceValueTarget.id}`,
				targetReferenceId: accountFollowPreference.targetReferenceId,
				favorite: accountFollowPreference.favorite,
				position: accountFollowPreference.position,
			})
			.from(accountFollowPreference)
			.innerJoin(referenceValue, eq(referenceValue.id, accountFollowPreference.targetReferenceId))
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					followingCursorCondition(cursor),
				),
			)
			.orderBy(
				sql`${accountFollowPreference.favorite} desc nulls last`,
				accountFollowPreference.position,
				accountFollowPreference.targetReferenceId,
			)
			.limit(512);
		if (!candidates.length) return { rows: [], lastScanned: undefined, exhausted: true };

		const readable = new Set<string>();
		for (let offset = 0; offset < candidates.length; offset += 500) {
			const ids = await input.authorization.unit.readableUnitIdsInTransaction(
				tx,
				candidates.slice(offset, offset + 500).map((row) => row.unitId),
			);
			for (const id of ids) readable.add(id);
		}
		const state = unitStateRelation(referenceValueTarget.id, "following_target_state");
		const rows = await tx
			.select({
				id: state.id,
				targetReferenceId: accountFollowPreference.targetReferenceId,
				owner: state.owner,
				shape: state.shape,
				coverAssetId: resolvedUnitLocalizationImageAssetId(
					state.id,
					"cover",
					localizationLanguages,
				),
				position: accountFollowPreference.position,
				favorite: accountFollowPreference.favorite,
				createdAt: accountFollowPreference.createdAt,
				updatedAt: accountFollowPreference.updatedAt,
			})
			.from(accountFollowPreference)
			.innerJoin(referenceValue, eq(referenceValue.id, accountFollowPreference.targetReferenceId))
			.innerJoinLateral(state, sql`true`)
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					ne(state.owner, "tag_path"),
					input.owner ? eq(state.owner, input.owner) : undefined,
					inArray(state.id, [...readable]),
					getContentRatingCondition(contentRatingPolicy, state.contentRating),
					inArray(
						accountFollowPreference.targetReferenceId,
						candidates.map((item) => item.targetReferenceId),
					),
				),
			)
			.orderBy(
				sql`${accountFollowPreference.favorite} desc nulls last`,
				accountFollowPreference.position,
				accountFollowPreference.targetReferenceId,
			)
			.limit(input.limit + 1);

		const presentations = await readUnitPresentationsInTransaction(
			tx,
			rows.map((row) => row.id),
			localizationLanguages,
		);
		return {
			rows: rows.map((row) => ({
				...row,
				title: presentations.get(row.id)?.title ?? null,
				language: presentations.get(row.id)?.language ?? null,
				presentedAvatar: presentations.get(row.id)?.avatar ?? null,
			})),
			lastScanned: candidates.at(-1),
			exhausted: candidates.length < 512,
		};
	});
	const rows = scan.rows;
	const items = rows.slice(0, input.limit);
	const last = items.at(-1);
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(items.map((item) => item.id));
	return {
		items: items.map(
			({ presentedAvatar, coverAssetId, targetReferenceId: _referenceId, ...record }) => ({
				...record,
				owner: requireFollowableUnitOwner(record.owner),
				slugAddress: slugAddresses.get(record.id) ?? null,
				avatar: presentedAvatar,
				cover: presentImageAsset(coverAssetId, "cover"),
			}),
		),
		nextCursor:
			rows.length > input.limit && last
				? encodeFollowingCursor(
						input.owner,
						localizationLanguages,
						contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
						{
							favorite: last.favorite,
							position: last.position,
							targetReferenceId: last.targetReferenceId,
						},
					)
				: !scan.exhausted && scan.lastScanned
					? encodeFollowingCursor(
							input.owner,
							localizationLanguages,
							contentRatingPolicy.kind === "allow" ? contentRatingPolicy.ratings : [],
							scan.lastScanned,
						)
					: null,
	};
}

async function resolveFollowTarget(
	tx: DatabaseTransaction,
	unitId: string,
	authorization: FollowAuthorization,
): Promise<FollowTarget> {
	await lockUnitAccessState(tx, [unitId], "shared");
	const target = await readUnitStateById(tx, unitId, { lock: "share" });
	const decision = await authorization.unit.decideInTransaction(tx, unitId, "unit.read");
	if (!decision.allowed) throw new UnitNotFound();
	if (!target || target.reference.owner === "tag_path") throw new UnitNotFound();
	return { id: target.id, owner: target.reference.owner };
}

/** Record the account Self's public interest under current contribution and target-read authority. @internal */
export async function followUnit(input: {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	await database.transaction(async (tx) => {
		await lockFollowingAccount(
			tx,
			input.authUserId,
			input.followerProfileId,
			input.authorization,
			"contribute",
		);
		const target = await resolveFollowTarget(tx, input.unitId, input.authorization);
		if (target.id === input.followerProfileId) throw new UserSelfFollowForbidden();
		const [merged] = await tx
			.select({ id: unitMergeRedirect.sourceUnitId })
			.from(unitMergeRedirect)
			.where(eq(unitMergeRedirect.sourceUnitId, target.id))
			.limit(1);
		if (merged) throw new UnitNotFound("Follow target");
		const { reference } = await resolveRegisteredUnitReference(tx, target.id);
		const targetReferenceId = await allocateReferenceValue(tx, reference);
		if (target.owner === "entity") {
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
			.values({ followerProfileId: input.followerProfileId, targetReferenceId })
			.onConflictDoNothing()
			.returning({ targetReferenceId: unitFollow.targetReferenceId });
		await tx
			.insert(accountFollowPreference)
			.values({
				authUserId: input.authUserId,
				followerEntityId: input.followerProfileId,
				targetReferenceId,
			})
			.onConflictDoNothing();
		if (created && target.owner === "entity")
			await createNotification(tx, {
				kind: "new_follower",
				recipientEntityId: target.id,
				actorProfileId: input.followerProfileId,
				dedupeKey: `new-follower:${input.followerProfileId}:${target.id}`,
			});
		if (target.owner === "realm")
			await acknowledgeCurrentRealmRulesOnFollow(tx, target.id, input.followerProfileId);
		await resolveFollowTarget(tx, input.unitId, input.authorization);
		await input.authorization.account.ensureCanContribute(tx);
	});
	return { following: true as const };
}

/** Remove the account Self's choice even when its target is no longer readable. @internal */
export async function unfollowUnit(
	authUserId: string,
	followerProfileId: string,
	unitId: string,
	authorization: FollowAuthorization,
) {
	await database.transaction(async (tx) => {
		await lockFollowingAccount(tx, authUserId, followerProfileId, authorization, "write");
		const reference = await findReferenceValueByNativeId(tx, unitId);
		if (reference)
			await tx
				.delete(unitFollow)
				.where(
					and(
						eq(unitFollow.followerProfileId, followerProfileId),
						eq(unitFollow.targetReferenceId, reference.valueId),
					),
				);
		await authorization.account.ensureCanWrite(tx);
	});
	return { following: false as const };
}

/** Read private follow status after admitting the current Self and target. @internal */
export async function getFollowingStatus(input: {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	return database.transaction(async (tx) => {
		await lockFollowingAccount(
			tx,
			input.authUserId,
			input.followerProfileId,
			input.authorization,
			"read",
		);
		const target = await resolveFollowTarget(tx, input.unitId, input.authorization);
		const reference = await findReferenceValueByNativeId(tx, target.id);
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
					eq(accountFollowPreference.targetReferenceId, reference?.valueId ?? sql`null::uuid`),
				),
			)
			.limit(1);
		if (target.owner === "realm") {
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
					owner: target.owner,
					favorite: null,
					position: null,
					inAppNotificationsEnabled: null,
					realmTagSourceSubscribed,
				};
			return {
				following: true as const,
				owner: target.owner,
				favorite: record.favorite,
				position: record.position,
				inAppNotificationsEnabled: record.inAppNotificationsEnabled ?? true,
				realmTagSourceSubscribed,
			};
		}
		if (!record)
			return {
				following: false as const,
				owner: target.owner,
				favorite: null,
				position: null,
				inAppNotificationsEnabled: null,
				realmTagSourceSubscribed: null,
			};
		return {
			following: true as const,
			owner: target.owner,
			favorite: record.favorite,
			position: record.position,
			inAppNotificationsEnabled: record.inAppNotificationsEnabled ?? true,
			realmTagSourceSubscribed: null,
		};
	});
}

/** Replace private delivery choices and retain authority through blocking writes. @internal */
export async function replaceFollowingSettings(input: {
	readonly authUserId: string;
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
	readonly settings: ReplaceFollowingSettings;
}) {
	const follow = await database.transaction(async (tx) => {
		await lockFollowingAccount(
			tx,
			input.authUserId,
			input.followerProfileId,
			input.authorization,
			"write",
		);
		const target = await resolveFollowTarget(tx, input.unitId, input.authorization);
		if (target.owner !== input.settings.owner) throw new FollowingTargetKindMismatch();
		const reference = await findReferenceValueByNativeId(tx, target.id);
		if (!reference) throw new UnitNotFound("Follow");
		const targetReferenceId = reference.valueId;
		const [record] = await tx
			.select({
				favorite: accountFollowPreference.favorite,
				position: accountFollowPreference.position,
			})
			.from(accountFollowPreference)
			.where(
				and(
					eq(accountFollowPreference.authUserId, input.authUserId),
					eq(accountFollowPreference.targetReferenceId, targetReferenceId),
				),
			)
			.limit(1);
		if (!record) throw new UnitNotFound("Follow");

		await tx
			.insert(accountFollowPreference)
			.values({
				authUserId: input.authUserId,
				followerEntityId: input.followerProfileId,
				targetReferenceId,
				inApp: input.settings.inAppNotificationsEnabled,
			})
			.onConflictDoUpdate({
				target: [accountFollowPreference.authUserId, accountFollowPreference.targetReferenceId],
				set: {
					inApp: input.settings.inAppNotificationsEnabled,
					updatedAt: new Date(),
				},
			});

		if (input.settings.owner === "realm") {
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
		await resolveFollowTarget(tx, input.unitId, input.authorization);
		await input.authorization.account.ensureCanWrite(tx);
		return record;
	});

	if (input.settings.owner === "realm")
		return {
			following: true as const,
			owner: input.settings.owner,
			favorite: follow.favorite,
			position: follow.position,
			inAppNotificationsEnabled: input.settings.inAppNotificationsEnabled,
			realmTagSourceSubscribed: input.settings.realmTagSourceSubscribed,
		};
	return {
		following: true as const,
		owner: input.settings.owner,
		favorite: follow.favorite,
		position: follow.position,
		inAppNotificationsEnabled: input.settings.inAppNotificationsEnabled,
		realmTagSourceSubscribed: null,
	};
}

/** Edit private order/favorite state under the account's current write policy. @internal */
export async function updateFollowingPresentation(
	authUserId: string,
	followerProfileId: string,
	unitId: string,
	input: { readonly favorite?: boolean; readonly position?: string },
	authorization: FollowAuthorization,
) {
	return database.transaction(async (tx) => {
		await lockFollowingAccount(tx, authUserId, followerProfileId, authorization, "write");
		const reference = await findReferenceValueByNativeId(tx, unitId);
		if (!reference) throw new UnitNotFound("Follow");
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
					eq(accountFollowPreference.targetReferenceId, reference.valueId),
				),
			)
			.returning({
				unitId: sql<string>`public.reference_value_native_id(${accountFollowPreference.targetReferenceId})`,
				position: accountFollowPreference.position,
				favorite: accountFollowPreference.favorite,
				updatedAt: accountFollowPreference.updatedAt,
			});
		if (!updated) throw new UnitNotFound("Follow");
		await authorization.account.ensureCanWrite(tx);
		return updated;
	});
}
