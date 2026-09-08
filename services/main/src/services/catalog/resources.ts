import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogNameTables } from "../database/schema/catalog-names";
import {
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	canAccessCatalog,
} from "../participation/policy";
import { type CatalogReference } from "./contracts";
import {
	CreateCatalogResourceSchema,
	CatalogCreatedSchema,
	CatalogResourceSchema,
	CatalogNamedFormSchema,
	CatalogIdentifierSchema,
	CatalogLifecycleInputSchema,
} from "./resource-contracts";
import {
	createPublishingWork,
	createTextVersion,
	createPublication,
	createMusicalWork,
	createRecording,
	createReleaseGroup,
	createMusicRelease,
} from "./domains";
import { createSerialization } from "./publishing";
import { createProgramStructure } from "./program";
import {
	createNativeSoftwareContent,
	createSoftwareVersion,
	createNativeSoftwareRelease,
} from "./software";
import { createEntity } from "./entities";
import { createReference } from "./references";
import { createGrouping } from "./grouping";
import { createDistributionPackage } from "./distribution";
import { addCatalogName, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { catalogWirePage } from "./resource-pagination";

/** @alpha Creates through the owning native command; public identity never implies participation rights. */
export async function createCatalogResource(
	tx: DatabaseTransaction,
	actor: string,
	input: z.input<typeof CreateCatalogResourceSchema>,
) {
	const value = CreateCatalogResourceSchema.parse(input);
	const created = await (async () => {
		switch (value.kind) {
			case "publishing_work":
				return createPublishingWork(tx, actor, value.name);
			case "text_version":
				return createTextVersion(tx, actor, { name: value.name, languageTag: value.languageTag });
			case "publication":
				return createPublication(tx, actor, {
					name: value.name,
					pageCount: value.pageCount,
					paginationText: value.paginationText,
				});
			case "serialization":
				return createSerialization(tx, actor, {
					name: value.name,
					textVersionId: value.textVersionId,
					statusRevisionId: value.statusRevisionId,
				});
			case "musical_work":
				return createMusicalWork(tx, actor, value.name);
			case "recording":
				return createRecording(tx, actor, {
					name: value.name,
					artistCreditId: value.artistCreditId,
					lengthMilliseconds: value.lengthMilliseconds,
					video: value.video,
				});
			case "release_group":
				return createReleaseGroup(tx, actor, value.name);
			case "music_release":
				return createMusicRelease(tx, actor, {
					name: value.name,
					releaseGroup: value.releaseGroup,
					artistCreditId: value.artistCreditId,
					languageTag: value.languageTag,
					scriptCode: value.scriptCode,
				});
			case "software_content":
				return createNativeSoftwareContent(tx, actor, {
					name: value.name,
					visualNovel: value.visualNovel,
					details: value.details,
				});
			case "software_version":
				return createSoftwareVersion(tx, actor, {
					name: value.name,
					content: value.content,
					details: value.details,
				});
			case "software_release":
				return createNativeSoftwareRelease(tx, actor, { name: value.name, details: value.details });
			case "program":
				return createProgramStructure(tx, actor, value.structure, value.name);
			case "entity":
				return createEntity(tx, actor, {
					name: value.name,
					shape: value.shape,
					profile: value.profile,
				});
			case "reference":
				return createReference(tx, actor, { name: value.name, profile: value.profile });
			case "grouping":
				return createGrouping(tx, actor, { name: value.name, classes: value.classes });
			case "distribution": {
				const identity = await createDistributionPackage(tx, actor);
				const named = await addCatalogName(tx, identity, actor, identity.revision, {
					...value.name,
					kind: "primary",
				});
				return { ...identity, revision: named.revision };
			}
		}
	})();
	return CatalogCreatedSchema.parse({
		reference: { owner: created.owner, id: created.id },
		revision: created.revision,
	});
}

/** @alpha Reads only the owner-local identity and excludes private account provenance. */
export async function readCatalogResource(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
) {
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	return CatalogResourceSchema.parse({
		reference,
		canEdit: await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, true),
		shape: identity.shape,
		revision: identity.revision,
		status: identity.status,
		visibility: identity.visibility,
		contentRating: identity.contentRating,
		moderationStatus: identity.moderationStatus,
		createdAt: identity.createdAt.toISOString(),
		updatedAt: identity.updatedAt.toISOString(),
	});
}

/** @alpha Changes publication and visibility under the canonical revision fence; moderation is separately governed. */
export async function updateCatalogLifecycle(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: z.input<typeof CatalogLifecycleInputSchema>,
) {
	const value = CatalogLifecycleInputSchema.parse(input);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		value.expectedRevision,
		"identity.lifecycle.update",
	);
	const table = CatalogIdentityTables[reference.owner];
	await tx
		.update(table)
		.set({ status: value.status, visibility: value.visibility, contentRating: value.contentRating })
		.where(eq(table.id, reference.id));
	return { revision };
}

export function presentCatalogName(row: typeof CatalogNameTables.publishing.name.$inferSelect) {
	const {
		recordedByAuthUserId: _actor,
		languagePolicy: _policy,
		createdAt,
		recordedAt,
		...value
	} = row;
	return CatalogNamedFormSchema.parse({
		...value,
		createdAt: createdAt.toISOString(),
		recordedAt: recordedAt.toISOString(),
	});
}
export function presentCatalogIdentifier(
	row: typeof CatalogNameTables.publishing.identifier.$inferSelect,
) {
	const { recordedByAuthUserId: _actor, createdAt, recordedAt, ...value } = row;
	return CatalogIdentifierSchema.parse({
		...value,
		createdAt: createdAt.toISOString(),
		recordedAt: recordedAt.toISOString(),
	});
}

const listInput = z.strictObject({
	afterId: z.uuid().optional(),
	limit: z.number().int().min(1).max(100).default(50),
	maxSpoiler: z.number().int().min(0).max(2).default(0),
});
/** @alpha Bounded candidate pagination preserves continuation even when visibility removes a whole page. */
export async function pageCatalogNames(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: z.input<typeof listInput> = {},
) {
	const page = listInput.parse(input);
	await loadCatalogIdentity(tx, reference, actor, false);
	const scope = await readCatalogAuthorityScope(tx, actor),
		table = CatalogNameTables[reference.owner].name,
		identity = CatalogIdentityTables[reference.owner];
	const visible = sql<boolean>`${table.scopeOwnerId} is null or exists(select 1 from ${identity} where ${identity.id}=${table.scopeOwnerId} and ${catalogIdentityReadPredicate(scope, reference.owner, identity)})`;
	const rows = await tx
		.select({ row: table, readable: visible })
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), page.afterId ? gt(table.id, page.afterId) : undefined),
		)
		.orderBy(table.id)
		.limit(page.limit + 1);
	return catalogWirePage(
		rows.map(({ row, readable }) => ({
			id: row.id,
			value:
				readable &&
				row.spoiler <= page.maxSpoiler &&
				(row.state === "active" || row.state === "disputed")
					? presentCatalogName(row)
					: null,
		})),
		page.limit,
	);
}

/** @alpha Identifier pages disclose only issuer identities readable in the same request scope. */
export async function pageCatalogIdentifiers(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: { afterId?: string; limit?: number } = {},
) {
	const page = listInput.omit({ maxSpoiler: true }).parse(input);
	await loadCatalogIdentity(tx, reference, actor, false);
	const scope = await readCatalogAuthorityScope(tx, actor),
		table = CatalogNameTables[reference.owner].identifier,
		entity = CatalogIdentityTables.entity;
	const visible = sql<boolean>`${table.issuerEntityId} is null or exists(select 1 from ${entity} where ${entity.id}=${table.issuerEntityId} and ${catalogIdentityReadPredicate(scope, "entity", entity)})`;
	const rows = await tx
		.select({ row: table, readable: visible })
		.from(table)
		.where(
			and(eq(table.ownerId, reference.id), page.afterId ? gt(table.id, page.afterId) : undefined),
		)
		.orderBy(table.id)
		.limit(page.limit + 1);
	return catalogWirePage(
		rows.map(({ row, readable }) => ({
			id: row.id,
			value:
				readable && (row.state === "active" || row.state === "disputed")
					? presentCatalogIdentifier(row)
					: null,
		})),
		page.limit,
	);
}
