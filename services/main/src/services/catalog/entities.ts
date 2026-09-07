import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	entityCatalogProfile,
	entityCatalogProfileRevision,
} from "../database/schema/catalog-entity";
import { catalogDefinition, catalogDefinitionRevision } from "../database/schema/catalog-identity";
import { CatalogPartialDateSchema, type CatalogReference } from "./contracts";
import {
	CreateEntitySchema,
	EntityProfileSchema,
	EntityShapeSchema,
	type EntityProfileInput,
} from "./entity-contracts";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
	CatalogReferenceNotFound,
} from "./storage";

/** @internal Validates the meaning of optional classification references before fixed-field writes. */
export async function requireProfileDefinition(
	tx: DatabaseTransaction,
	id: string | null,
	kinds: readonly string[],
) {
	if (id === null) return;
	const [row] = await tx
		.select({ kind: catalogDefinition.kind })
		.from(catalogDefinitionRevision)
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(eq(catalogDefinitionRevision.id, id))
		.limit(1);
	if (!row || !kinds.includes(row.kind))
		throw new TypeError("Profile classification has an incompatible definition kind");
}

/** @internal Fixed domain foreign keys also obey target readability and concrete shape. */
export async function requireProfileTarget(
	tx: DatabaseTransaction,
	id: string | null,
	actor: string | null,
	shape: string,
) {
	if (id === null) return;
	const row = await loadCatalogIdentity(tx, { owner: "reference", id }, actor, false);
	if (row.shape !== shape) throw new TypeError(`Expected ${shape} reference`);
}

/**
 * Author a person, organization, imprint, collective or character without a source key.
 * @alpha
 * @remarks Creator-only internal command; source adapters invoke the same profile writer.
 */
export async function createEntity(
	tx: DatabaseTransaction,
	actor: string,
	input: z.input<typeof CreateEntitySchema>,
) {
	const value = CreateEntitySchema.parse(input);
	const identity = await createCatalogIdentity(tx, { owner: "entity", shape: value.shape }, actor);
	const profile = await initializeEntityProfile(
		tx,
		identity,
		actor,
		identity.revision,
		value.profile,
	);
	const name = await addCatalogName(tx, identity, actor, profile.revision, {
		...value.name,
		kind: "primary",
	});
	return { ...identity, revision: name.revision, nameId: name.id };
}

/**
 * Accept a complete profile onto a resolved identity, preserving the previous fixed-field revision.
 * @alpha
 * @remarks Both imported stubs and manual edits use optimistic concurrency. Omitted fields mean unknown.
 */
export async function initializeEntityProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: EntityProfileInput,
) {
	if (ref.owner !== "entity") throw new TypeError("Expected entity owner");
	const value = EntityProfileSchema.parse(input);
	const identity = await loadCatalogIdentity(tx, ref, actor, true);
	const shape = EntityShapeSchema.parse(identity.shape);
	if (value.genderRevisionId !== null && !["person", "character", "unresolved"].includes(shape))
		throw new TypeError("Only an individual entity has a gender classification");
	await requireProfileDefinition(tx, value.typeRevisionId, ["class", "vocabulary"]);
	await requireProfileDefinition(tx, value.genderRevisionId, ["vocabulary"]);
	for (const id of [value.areaId, value.beginAreaId, value.endAreaId])
		await requireProfileTarget(tx, id, actor, "area");
	const revision = await recordCatalogChange(tx, ref, actor, expectedVersion, "entity.profile.set");
	const fields = {
		identityShape: shape,
		typeRevisionId: value.typeRevisionId,
		genderRevisionId: value.genderRevisionId,
		areaId: value.areaId,
		beginAreaId: value.beginAreaId,
		endAreaId: value.endAreaId,
		beginYear: value.begin?.year ?? null,
		beginMonth: value.begin?.month ?? null,
		beginDay: value.begin?.day ?? null,
		beginText: value.begin?.text ?? null,
		endYear: value.end?.year ?? null,
		endMonth: value.end?.month ?? null,
		endDay: value.end?.day ?? null,
		endText: value.end?.text ?? null,
		ended: value.ended,
	};
	await tx
		.insert(entityCatalogProfile)
		.values({ id: ref.id, ...fields })
		.onConflictDoUpdate({ target: entityCatalogProfile.id, set: fields });
	await tx
		.insert(entityCatalogProfileRevision)
		.values({ ownerId: ref.id, revision, snapshot: value });
	return { revision };
}

/** @alpha @remarks Current canonical fixed values; names and relations have separate paged readers. */
export async function readEntityProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string | null,
) {
	if (ref.owner !== "entity") throw new TypeError("Expected entity owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, false);
	const [row] = await tx
		.select()
		.from(entityCatalogProfile)
		.where(eq(entityCatalogProfile.id, ref.id))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Entity profile is missing");
	const date = (
		year: number | null,
		month: number | null,
		day: number | null,
		text: string | null,
	) =>
		year === null && month === null && day === null && text === null
			? null
			: { ...CatalogPartialDateSchema.parse({ year, month, day }), text };
	return {
		owner: ref.owner,
		id: ref.id,
		shape: EntityShapeSchema.parse(identity.shape),
		revision: identity.revision,
		profile: EntityProfileSchema.parse({
			typeRevisionId: row.typeRevisionId,
			genderRevisionId: row.genderRevisionId,
			areaId: row.areaId,
			beginAreaId: row.beginAreaId,
			endAreaId: row.endAreaId,
			begin: date(row.beginYear, row.beginMonth, row.beginDay, row.beginText),
			end: date(row.endYear, row.endMonth, row.endDay, row.endText),
			ended: row.ended,
		}),
	};
}

/** @alpha @remarks History is owner-scoped and protected by current access, including after withdrawal. */
export async function readEntityProfileHistory(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string | null,
	input: { afterRevision?: number; limit?: number } = {},
) {
	if (ref.owner !== "entity") throw new TypeError("Expected entity owner");
	await loadCatalogIdentity(tx, ref, actor, false);
	const page = z
		.strictObject({
			afterRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const table = entityCatalogProfileRevision;
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
	return rows.map((row) => ({ ...row, snapshot: EntityProfileSchema.parse(row.snapshot) }));
}

/** @alpha @remarks Restore creates a new decision and rechecks present target access and definition meaning. */
export async function restoreEntityProfile(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedVersion: number,
	revision: number,
) {
	if (ref.owner !== "entity") throw new TypeError("Expected entity owner");
	z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(revision);
	await loadCatalogIdentity(tx, ref, actor, true);
	const table = entityCatalogProfileRevision;
	const [row] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, ref.id), eq(table.revision, revision)))
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Entity profile revision is missing");
	return initializeEntityProfile(
		tx,
		ref,
		actor,
		expectedVersion,
		EntityProfileSchema.parse(row.snapshot),
	);
}
