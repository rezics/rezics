import { and, asc, eq, notInArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { profile, unitFollow } from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import { OfficialZoneManifest } from "./data";

function officialPositionsBefore(rightBoundary: string | null): string[] {
	const positions = new Array<string>(OfficialZoneManifest.length);
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
	profileIds?: readonly string[],
	options: { readonly sequenceIsEmpty?: boolean } = {},
): Promise<void> {
	const targets = profileIds
		? [...new Set(profileIds)]
		: (await tx.select({ id: profile.id }).from(profile)).map(({ id }) => id);
	const officialZoneIds = OfficialZoneManifest.map(({ id }) => id);
	if (options.sequenceIsEmpty) {
		const positions = officialPositionsBefore(null);
		await tx
			.insert(unitFollow)
			.values(
				targets.flatMap((profileId) =>
					officialZoneIds.map((zoneId, index) => {
						const position = positions[index];
						if (!position) throw new Error("Missing official Zone follow position");
						return { followerProfileId: profileId, unitId: zoneId, position };
					}),
				),
			)
			.onConflictDoNothing();
		return;
	}

	for (const profileId of targets) {
		const [firstOrdinaryFollow] = await tx
			.select({ position: unitFollow.position })
			.from(unitFollow)
			.where(
				and(
					eq(unitFollow.followerProfileId, profileId),
					eq(unitFollow.favorite, false),
					notInArray(unitFollow.unitId, officialZoneIds),
				),
			)
			.orderBy(asc(unitFollow.position), asc(unitFollow.unitId))
			.limit(1);
		const positions = officialPositionsBefore(firstOrdinaryFollow?.position ?? null);
		for (const [index, zoneId] of officialZoneIds.entries()) {
			const position = positions[index];
			if (!position) throw new Error("Missing official Zone follow position");
			await tx
				.insert(unitFollow)
				.values({ followerProfileId: profileId, unitId: zoneId, position })
				.onConflictDoNothing();
		}
	}
}
