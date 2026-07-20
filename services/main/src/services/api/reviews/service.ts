import { score } from "../../database/schema";
import type { DatabaseTransaction } from "../../database";

export async function upsertScore(
	tx: DatabaseTransaction,
	userId: string,
	targetId: string,
	realmId: string,
	value: number,
) {
	const [entry] = await tx
		.insert(score)
		.values({ profileId: userId, unitId: targetId, realmId, value })
		.onConflictDoUpdate({
			target: [score.profileId, score.unitId, score.realmId],
			set: { value, updatedAt: new Date() },
		})
		.returning({ id: score.id });
	if (!entry) throw new Error("Score upsert did not return an id");
	return entry.id;
}
