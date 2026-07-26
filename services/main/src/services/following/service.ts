import { and, desc, eq, gt, or } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import type { UnitAuthorization } from "../authorization/unit/authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import { profileBlock, unit, unitFollow } from "../database/schema";
import type { UnitKind } from "../database/schema/contract-values";
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
import {
	decodeFollowingCursor,
	encodeFollowingCursor,
	type FollowingCursorBoundary,
} from "./cursor";
import { UserFollowBlocked, UserSelfFollowForbidden } from "./errors";

type FollowTarget = {
	readonly id: string;
	readonly kind: UnitKind;
};

type FollowAuthorization = Pick<UnitAuthorization<string>, "ensureCanRead">;

type ListFollowingInput = {
	readonly followerProfileId: string;
	readonly kind?: UnitKind;
	readonly language?: ContentLanguage;
	readonly cursor?: string;
	readonly limit: number;
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
	const cursor = decodeFollowingCursor(input.cursor, input.kind, input.language);
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: resolvedUnitLocalizationLanguage(unit.id, input.language),
			title: resolvedUnitLocalizationTitle(unit.id, input.language),
			avatar: resolvedUnitLocalizationAvatar(unit.id, input.language),
			coverAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "cover", input.language),
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
				input.kind ? eq(unit.kind, input.kind) : undefined,
				getUnitReadCondition(input.followerProfileId),
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
			slugAddress: slugAddresses.get(record.id) ?? null,
			avatar: presentAvatar(avatar),
			cover: presentImageAsset(coverAssetId, "cover"),
		})),
		nextCursor:
			rows.length > input.limit && last
				? encodeFollowingCursor(input.kind, input.language, {
						favorite: last.favorite,
						position: last.position,
						unitId: last.id,
					})
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
	return target;
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

		await tx
			.insert(unitFollow)
			.values({ followerProfileId: input.followerProfileId, unitId: target.id })
			.onConflictDoNothing();
	});
	return { following: true as const };
}

export async function unfollowUnit(followerProfileId: string, unitId: string) {
	await database
		.delete(unitFollow)
		.where(
			and(eq(unitFollow.followerProfileId, followerProfileId), eq(unitFollow.unitId, unitId)),
		);
	return { following: false as const };
}

export async function getFollowingStatus(input: {
	readonly followerProfileId: string;
	readonly unitId: string;
	readonly authorization: FollowAuthorization;
}) {
	const target = await resolveFollowTarget(input.unitId, input.authorization);
	const [record] = await database
		.select({ favorite: unitFollow.favorite, position: unitFollow.position })
		.from(unitFollow)
		.where(
			and(
				eq(unitFollow.followerProfileId, input.followerProfileId),
				eq(unitFollow.unitId, target.id),
			),
		)
		.limit(1);
	return record
		? { following: true as const, favorite: record.favorite, position: record.position }
		: { following: false as const, favorite: null, position: null };
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
		.where(
			and(eq(unitFollow.followerProfileId, followerProfileId), eq(unitFollow.unitId, unitId)),
		)
		.returning({
			unitId: unitFollow.unitId,
			position: unitFollow.position,
			favorite: unitFollow.favorite,
			updatedAt: unitFollow.updatedAt,
		});
	if (!updated) throw new UnitNotFound("Follow");
	return updated;
}
