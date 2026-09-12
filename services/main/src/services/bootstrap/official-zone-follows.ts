import { allocateReferenceValue } from "../units/reference-value";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { authEntity, accountFollowPreference, unitFollow } from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import { OfficialZoneUnitIds } from "@rezics/slug";

const officialZoneIds = Object.values(OfficialZoneUnitIds);

function officialPositionsBefore(rightBoundary: string | null): string[] {
	const positions = new Array<string>(officialZoneIds.length);
	let right = rightBoundary;
	for (let index = positions.length - 1; index >= 0; index -= 1) {
		const position = fractionalPositionBetween(null, right);
		positions[index] = position;
		right = position;
	}
	return positions;
}

/**
 * Insert missing official Zone follows. Existing follow rows and positions
 * are left untouched, including favorite choices.
 */
export async function ensureOfficialZoneFollows(
	tx: DatabaseTransaction,
	profileIds: readonly string[],
	options: { readonly sequenceIsEmpty?: boolean } = {},
): Promise<void> {
	const targets = [...new Set(profileIds)];
	if (targets.length > 512)
		throw new RangeError("Official defaults accept at most 512 admitted accounts per batch");
	if (!targets.length) return;
	const bindings = await tx
		.select({ authUserId: authEntity.authUserId, entityId: authEntity.entityId })
		.from(authEntity)
		.where(inArray(authEntity.entityId, targets));
	const authByEntity = new Map(bindings.map((binding) => [binding.entityId, binding.authUserId]));
	const authFor = (entityId: string) => {
		const id = authByEntity.get(entityId);
		if (!id) throw new Error("Official defaults require admitted accounts, not catalog subjects");
		return id;
	};
	for (const entityId of targets) authFor(entityId);
	const references = new Map<string, string>();
	for (const id of officialZoneIds)
		references.set(id, await allocateReferenceValue(tx, { owner: "zone", id }));
	const referenceFor = (id: string) => {
		const value = references.get(id);
		if (!value) throw new Error("Official Zone reference is unavailable");
		return value;
	};
	const officialReferenceIds = [...references.values()];
	if (options.sequenceIsEmpty) {
		const positions = officialPositionsBefore(null);
		await tx
			.insert(unitFollow)
			.values(
				targets.flatMap((profileId) =>
					officialZoneIds.map((unitId) => ({
						followerProfileId: profileId,
						targetReferenceId: referenceFor(unitId),
					})),
				),
			)
			.onConflictDoNothing();
		await tx
			.insert(accountFollowPreference)
			.values(
				targets.flatMap((profileId) =>
					officialZoneIds.map((unitId, index) => ({
						authUserId: authFor(profileId),
						followerEntityId: profileId,
						targetReferenceId: referenceFor(unitId),
						position: positions[index]!,
					})),
				),
			)
			.onConflictDoNothing();
		return;
	}

	for (const profileId of targets) {
		const [firstOrdinaryFollow] = await tx
			.select({ position: accountFollowPreference.position })
			.from(accountFollowPreference)
			.where(
				and(
					eq(accountFollowPreference.authUserId, authFor(profileId)),
					eq(accountFollowPreference.favorite, false),
					notInArray(accountFollowPreference.targetReferenceId, officialReferenceIds),
				),
			)
			.orderBy(
				asc(accountFollowPreference.position),
				asc(accountFollowPreference.targetReferenceId),
			)
			.limit(1);
		const positions = officialPositionsBefore(firstOrdinaryFollow?.position ?? null);
		for (const [index, zoneId] of officialZoneIds.entries()) {
			const position = positions[index];
			if (!position) throw new Error("Missing official Zone follow position");
			await tx
				.insert(unitFollow)
				.values({ followerProfileId: profileId, targetReferenceId: referenceFor(zoneId) })
				.onConflictDoNothing();
			await tx
				.insert(accountFollowPreference)
				.values({
					authUserId: authFor(profileId),
					followerEntityId: profileId,
					targetReferenceId: referenceFor(zoneId),
					position,
				})
				.onConflictDoNothing();
		}
	}
}
