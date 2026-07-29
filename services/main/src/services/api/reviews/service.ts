import { DefaultResourceVisibility, score } from "../../database/schema";
import type { ResourceVisibility } from "../../database/schema/contract-values";
import type { DatabaseTransaction } from "../../database";

export async function upsertScore(
	tx: DatabaseTransaction,
	userId: string,
	targetId: string,
	contextUnitId: string,
	value: number,
	visibility?: ResourceVisibility,
) {
	const resolvedVisibility = visibility ?? DefaultResourceVisibility;
	const [entry] = await tx
		.insert(score)
		.values({
			profileId: userId,
			unitId: targetId,
			contextUnitId,
			value,
			visibility: resolvedVisibility,
		})
		.onConflictDoUpdate({
			target: [score.profileId, score.unitId, score.contextUnitId],
			set: {
				value,
				...(visibility === undefined ? {} : { visibility }),
				updatedAt: new Date(),
			},
		})
		.returning({ id: score.id, visibility: score.visibility });
	if (!entry) throw new Error("Score upsert did not return an id");
	return entry;
}
