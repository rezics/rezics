import { and, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	referenceArea,
	referenceAreaCode,
	referencePlace,
	referenceInstrument,
	referenceEvent,
	referenceCatalogProfileRevision,
	referenceConcept,
	referenceWebResource,
} from "@rezics/schema/postgres/catalog/reference";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	AreaCodeSchema,
	NativeCatalogNameSchema,
	ReferenceProfileSchema,
	type ReferenceProfileInput,
} from "./entity-contracts";
import { requireProfileDefinition, requireProfileTarget } from "./entities";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
	CatalogReferenceNotFound,
} from "./storage";

/** @alpha @remarks Source-free reference creation uses the same fixed-field writer as source adoption. */
export async function createReference(
	tx: DatabaseTransaction,
	actor: string,
	input: { name: z.input<typeof NativeCatalogNameSchema>; profile: ReferenceProfileInput },
) {
	const name = NativeCatalogNameSchema.parse(input.name);
	const profile = ReferenceProfileSchema.parse(input.profile);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "reference", shape: profile.shape },
		actor,
	);
	const saved = await initializeReferenceProfile(tx, identity, actor, identity.revision, profile);
	const named = await addCatalogName(tx, identity, actor, saved.revision, {
		...name,
		kind: "primary",
	});
	return { ...identity, revision: named.revision, nameId: named.id };
}

/** @alpha @remarks Complete replacement; does not replace codes, aliases, relations or evidence collections. */
export async function initializeReferenceProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: ReferenceProfileInput,
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	const value = ReferenceProfileSchema.parse(input);
	const identity = await loadCatalogIdentity(tx, ref, actor, true);
	if (identity.shape !== value.shape)
		throw new TypeError("Reference profile shape differs from its identity");
	if ("typeRevisionId" in value)
		await requireProfileDefinition(tx, value.typeRevisionId, ["class", "vocabulary"]);
	if (value.shape === "place") await requireProfileTarget(tx, value.areaId, actor, "area");
	if (value.shape === "event") await requireProfileTarget(tx, value.placeId, actor, "place");
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"reference.profile.set",
	);
	const lifecycle = !("begin" in value)
		? {}
		: {
				dateYear: value.begin?.year ?? null,
				dateMonth: value.begin?.month ?? null,
				dateDay: value.begin?.day ?? null,
				dateText: value.begin?.text ?? null,
				endYear: value.end?.year ?? null,
				endMonth: value.end?.month ?? null,
				endDay: value.end?.day ?? null,
				endText: value.end?.text ?? null,
				ended: value.ended,
			};
	switch (value.shape) {
		case "concept": {
			const fields = { typeRevisionId: value.typeRevisionId };
			await tx
				.insert(referenceConcept)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referenceConcept.id, set: fields });
			break;
		}
		case "web_resource": {
			const fields = { url: value.url };
			await tx
				.insert(referenceWebResource)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referenceWebResource.id, set: fields });
			break;
		}
		case "area": {
			const fields = { typeRevisionId: value.typeRevisionId, ...lifecycle };
			await tx
				.insert(referenceArea)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referenceArea.id, set: fields });
			break;
		}
		case "instrument": {
			const fields = { typeRevisionId: value.typeRevisionId };
			await tx
				.insert(referenceInstrument)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referenceInstrument.id, set: fields });
			break;
		}
		case "place": {
			const fields = {
				typeRevisionId: value.typeRevisionId,
				areaId: value.areaId,
				address: value.address,
				latitude: value.latitude?.toString() ?? null,
				longitude: value.longitude?.toString() ?? null,
				...lifecycle,
			};
			await tx
				.insert(referencePlace)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referencePlace.id, set: fields });
			break;
		}
		case "event": {
			const fields = {
				typeRevisionId: value.typeRevisionId,
				placeId: value.placeId,
				localTime: value.localTime,
				cancelled: value.cancelled,
				setlist: value.setlist,
				...lifecycle,
			};
			await tx
				.insert(referenceEvent)
				.values({ id: ref.id, ...fields })
				.onConflictDoUpdate({ target: referenceEvent.id, set: fields });
			break;
		}
	}
	await tx
		.insert(referenceCatalogProfileRevision)
		.values({ ownerId: ref.id, revision, snapshot: value });
	return { revision };
}

/** @alpha @remarks Canonical typed projection; scalar reads remain one point lookup after identity authorization. */
export async function readReferenceProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string | null,
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, false);
	const tables = {
		area: referenceArea,
		place: referencePlace,
		event: referenceEvent,
		instrument: referenceInstrument,
		concept: referenceConcept,
		web_resource: referenceWebResource,
	};
	const shape = z
		.enum(["area", "place", "event", "instrument", "concept", "web_resource"])
		.parse(identity.shape);
	const table = tables[shape];
	const [row] = await tx.select().from(table).where(eq(table.id, ref.id)).limit(1);
	if (!row) throw new CatalogReferenceNotFound("Reference profile is missing");
	const lifecycle =
		"dateYear" in row
			? {
					begin:
						row.dateYear === null &&
						row.dateMonth === null &&
						row.dateDay === null &&
						row.dateText === null
							? null
							: { year: row.dateYear, month: row.dateMonth, day: row.dateDay, text: row.dateText },
					end:
						row.endYear === null &&
						row.endMonth === null &&
						row.endDay === null &&
						row.endText === null
							? null
							: { year: row.endYear, month: row.endMonth, day: row.endDay, text: row.endText },
					ended: row.ended,
				}
			: {};
	const value = {
		shape,
		...("typeRevisionId" in row ? { typeRevisionId: row.typeRevisionId } : {}),
		...("url" in row ? { url: row.url } : {}),
		...lifecycle,
		...("latitude" in row
			? {
					areaId: row.areaId,
					address: row.address,
					latitude: row.latitude === null ? null : Number(row.latitude),
					longitude: row.longitude === null ? null : Number(row.longitude),
				}
			: {}),
		...("localTime" in row
			? {
					placeId: row.placeId,
					localTime: row.localTime,
					cancelled: row.cancelled,
					setlist: row.setlist,
				}
			: {}),
	};
	return {
		owner: ref.owner,
		id: ref.id,
		revision: identity.revision,
		profile: ReferenceProfileSchema.parse(value),
	};
}

/** @alpha @remarks Bounded history pages; does not materialize the owner's full event or alias graph. */
export async function readReferenceProfileHistory(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string | null,
	input: { afterRevision?: number; limit?: number } = {},
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	await loadCatalogIdentity(tx, ref, actor, false);
	const page = z
		.strictObject({
			afterRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = referenceCatalogProfileRevision;
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, ref.id),
				page.afterRevision ? gt(table.revision, page.afterRevision) : undefined,
			),
		)
		.orderBy(table.revision)
		.limit(page.limit);
	return rows.map((row) => ({ ...row, snapshot: ReferenceProfileSchema.parse(row.snapshot) }));
}

/** @alpha @remarks Restoring history revalidates target visibility and writes a new accepted revision. */
export async function restoreReferenceProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
	revision: number,
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(revision);
	await loadCatalogIdentity(tx, ref, actor, true);
	const table = referenceCatalogProfileRevision;
	const [row] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, ref.id), eq(table.revision, revision)))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Reference profile revision is missing");
	if (row.removed) return removeReferenceProfile(tx, ref, actor, expectedVersion);
	return initializeReferenceProfile(
		tx,
		ref,
		actor,
		expectedVersion,
		ReferenceProfileSchema.parse(row.snapshot),
	);
}

/** @alpha Remove fixed reference values; concrete dependent records must be removed through their own commands first. */
export async function removeReferenceProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, true);
	const tables = {
		concept: referenceConcept,
		web_resource: referenceWebResource,
		area: referenceArea,
		place: referencePlace,
		event: referenceEvent,
		instrument: referenceInstrument,
	};
	const shape = z
		.enum(["concept", "web_resource", "area", "place", "event", "instrument"])
		.parse(identity.shape);
	const table = tables[shape];
	const revision = await recordCatalogChange(
		tx,
		ref,
		actor,
		expectedVersion,
		"reference.profile.remove",
	);
	await tx.delete(table).where(eq(table.id, ref.id));
	await tx
		.insert(referenceCatalogProfileRevision)
		.values({ ownerId: ref.id, revision, removed: true, snapshot: { shape } });
	return { revision };
}

/** @alpha @remarks ISO and historical codes are namespaced claims, not unique native identities. */
export async function appendAreaCodes(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: readonly z.input<typeof AreaCodeSchema>[],
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	const values = z.array(AreaCodeSchema).min(1).max(128).parse(input);
	await requireProfileTarget(tx, ref.id, actor, "area");
	const revision = await recordCatalogChange(tx, ref, actor, expectedVersion, "area.code.append");
	await tx
		.insert(referenceAreaCode)
		.values(values.map((value) => ({ areaId: ref.id, ...value })))
		.onConflictDoNothing();
	return { revision };
}

/** @alpha @remarks Tuple-keyset paging supports repeated codes across areas and historical namespaces. */
export async function readAreaCodes(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string | null,
	input: { after?: z.input<typeof AreaCodeSchema>; limit?: number } = {},
) {
	if (ref.owner !== "reference") throw new TypeError("Expected reference owner");
	await requireProfileTarget(tx, ref.id, actor, "area");
	const page = z
		.strictObject({
			after: AreaCodeSchema.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = referenceAreaCode;
	return tx
		.select({ namespace: table.namespace, code: table.code })
		.from(table)
		.where(
			and(
				eq(table.areaId, ref.id),
				page.after
					? or(
							gt(table.namespace, page.after.namespace),
							and(eq(table.namespace, page.after.namespace), gt(table.code, page.after.code)),
						)
					: undefined,
			),
		)
		.orderBy(table.namespace, table.code)
		.limit(page.limit);
}
