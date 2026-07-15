import { and, eq, exists, inArray, or, sql } from "drizzle-orm";

import { database } from "../../database";
import { unit, unitCollaborator } from "../../database/schema";

export function getUnitReadCondition(profileId?: string) {
	const publicRead = and(
		eq(unit.status, "published"),
		inArray(unit.visibility, ["public", "unlisted"]),
		sql`${unit.deletedAt} is null`,
	);
	if (!profileId) return publicRead;
	return or(
		publicRead,
		and(
			sql`${unit.deletedAt} is null`,
			exists(
				database
					.select({ unitId: unitCollaborator.unitId })
					.from(unitCollaborator)
					.where(
						and(
							eq(unitCollaborator.unitId, unit.id),
							eq(unitCollaborator.profileId, profileId),
						),
					),
			),
		),
	);
}
