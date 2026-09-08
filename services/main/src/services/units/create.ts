import type { PlatformOwner } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import {
	video,
	audio,
	post,
	poll,
	zone,
	realm,
	realmRule,
	customTheme,
	collection,
	tag,
	tagPath,
	label,
} from "../database/schema";
import { recordInitialUnitStatus, type UnitStatusActor } from "./status";

const platformTables = {
	video: video,
	audio: audio,
	post: post,
	poll: poll,
	zone: zone,
	realm: realm,
	realm_rule: realmRule,
	custom_theme: customTheme,
	collection: collection,
	tag: tag,
	tag_path: tagPath,
	label: label,
};
export type CreatePlatformUnitInput = {
	[Owner in PlatformOwner]: {
		readonly owner: Owner;
		readonly values: (typeof platformTables)[Owner]["$inferInsert"];
		readonly statusActor: UnitStatusActor;
	};
}[PlatformOwner];

/** Creates one complete concrete owner row; identity metadata never requires a parent insert. */
export async function insertPlatformUnit(tx: DatabaseTransaction, input: CreatePlatformUnitInput) {
	const created = await insertOwner(tx, input, false);
	if (!created) throw new Error("Platform owner insertion did not return a row");
	await recordInitialUnitStatus(tx, {
		unitId: created.id,
		reference: { owner: input.owner, id: created.id },
		actor: input.statusActor,
	});
	return created;
}

/** Conflict handling is for an existing concrete owner row, never a global placeholder. */
export async function insertPlatformUnitIfMissing(
	tx: DatabaseTransaction,
	input: CreatePlatformUnitInput,
) {
	const created = await insertOwner(tx, input, true);
	if (!created) return null;
	await recordInitialUnitStatus(tx, {
		unitId: created.id,
		reference: { owner: input.owner, id: created.id },
		actor: input.statusActor,
	});
	return created;
}

async function insertOwner(
	tx: DatabaseTransaction,
	input: CreatePlatformUnitInput,
	ignoreConflict: boolean,
) {
	switch (input.owner) {
		case "video": {
			const query = tx.insert(video).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "audio": {
			const query = tx.insert(audio).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "post": {
			const query = tx.insert(post).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "poll": {
			const query = tx.insert(poll).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "zone": {
			const query = tx.insert(zone).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "realm": {
			const query = tx.insert(realm).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "realm_rule": {
			const query = tx.insert(realmRule).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "custom_theme": {
			const query = tx.insert(customTheme).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "collection": {
			const query = tx.insert(collection).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "tag": {
			const query = tx.insert(tag).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "tag_path": {
			const query = tx.insert(tagPath).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
		case "label": {
			const query = tx.insert(label).values(input.values);
			const [row] = await (ignoreConflict ? query.onConflictDoNothing() : query).returning();
			return row ? { ...row, reference: { owner: input.owner, id: row.id } } : null;
		}
	}
}
