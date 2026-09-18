import { nativePackDependencies } from "./native-contracts";
import { inArray, sql } from "drizzle-orm";
import { UnitOwnerValues } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { post } from "@rezics/schema/postgres/forum/post";
import { unitOwnerTable } from "@rezics/schema/postgres/shared/unit-reference-columns";
import type { LoadedPack, PackObject } from "./contracts";
import { ContentPackInvalid } from "./errors";

export const MaximumPackObjects = 10_000;
const IdentityReadBatchSize = 500;

/** Only declared owner primary keys are read; corpus size never changes the fixture's bounded work. */
export async function readPackIdentities(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceKeys?: readonly string[],
) {
	if (pack.objects.length > MaximumPackObjects)
		throw new ContentPackInvalid("Pack object budget exceeded");
	const selected = sourceKeys ? new Set(sourceKeys) : undefined;
	const result = [];
	for (const owner of UnitOwnerValues) {
		const ids = pack.objects
			.filter(
				(object) =>
					object.identity.owner === owner && (!selected || selected.has(object.sourceKey)),
			)
			.map((object) => pack.ids.units[object.sourceKey]!);
		const table = unitOwnerTable(owner);
		for (let offset = 0; offset < ids.length; offset += IdentityReadBatchSize) {
			const rows = await tx
				.select({
					id: table.id,
					shape:
						owner === "post"
							? sql<string>`${post.kind}`
							: "shape" in table
								? table.shape
								: sql<string>`${owner}`,
					status: table.status,
					visibility: table.visibility,
					contentRating: table.contentRating,
					moderationStatus: table.moderationStatus,
					deletedAt: table.deletedAt,
					aiDisclosure: "aiDisclosure" in table ? table.aiDisclosure : sql<string | null>`null`,
					postTargetingLocked:
						"postTargetingLocked" in table ? table.postTargetingLocked : sql<boolean | null>`null`,
				})
				.from(table)
				.where(inArray(table.id, ids.slice(offset, offset + IdentityReadBatchSize)));
			result.push(...rows.map((row) => ({ ...row, owner })));
		}
	}
	return result;
}

/** Native required links and Post subjects must exist before their dependent subtype is initialized. */
export function orderPackObjects(pack: LoadedPack): readonly PackObject[] {
	if (pack.objects.length > MaximumPackObjects)
		throw new ContentPackInvalid("Pack object budget exceeded");
	const byId = new Map(pack.objects.map((object) => [pack.ids.units[object.sourceKey]!, object]));
	const byKey = new Map(pack.objects.map((object) => [object.sourceKey, object]));

	const dependencies = new Map<string, Set<string>>(),
		dependents = new Map<string, Set<string>>();
	for (const object of pack.objects) {
		const required = new Set<string>();
		for (const id of object.native ? nativePackDependencies(object.native) : []) {
			const dependency = byId.get(id);
			if (dependency) required.add(dependency.sourceKey);
		}

		for (const key of [
			object.post?.subjectSourceKey,
			object.compiledZone?.localRuleRealmSourceKey,
			object.zonePage?.zoneSourceKey,
		])
			if (key && byKey.has(key)) required.add(key);
		dependencies.set(object.sourceKey, required);
		for (const key of required) {
			const next = dependents.get(key) ?? new Set<string>();
			next.add(object.sourceKey);
			dependents.set(key, next);
		}
	}
	const queue = pack.objects.filter((object) => dependencies.get(object.sourceKey)?.size === 0),
		ordered: PackObject[] = [];
	for (let offset = 0; offset < queue.length; offset++) {
		const object = queue[offset]!;
		ordered.push(object);
		for (const key of dependents.get(object.sourceKey) ?? []) {
			const required = dependencies.get(key)!;
			required.delete(object.sourceKey);
			if (!required.size) queue.push(byKey.get(key)!);
		}
	}
	if (ordered.length !== pack.objects.length)
		throw new ContentPackInvalid("Cyclic required native identity dependency");
	return ordered;
}
