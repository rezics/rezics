import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	parseSearchDocument,
	type SearchDocument,
	type SearchFilter,
	type SearchScalar,
} from "@rezics/search";
import { collectUnitFilterReferenceIds } from "@rezics/filter";

import { database, type DatabaseTransaction } from "../database";
import {
	searchDocument,
	searchDocumentRevisionHead,
	unit,
	zone,
	zoneSearchFeature,
} from "../database/schema";
import { UnitNotFound } from "../units/errors";
import {
	createSearchDocumentHistory,
	getSearchDocumentRevisionId,
	getSearchDocumentRevisionState,
	listSearchDocumentRevisions,
	restoreSearchDocumentHistory,
	updateSearchDocumentHistory,
} from "./document-history";
import { InvalidSearch, SearchDocumentRevisionConflict } from "./errors";
import { resolveSearchDocument } from "./templates";

export interface ZoneSearchFeatureProjection {
	readonly zoneId: string;
	readonly searchDocumentId: string;
	readonly enabled: boolean;
	readonly document: SearchDocument;
	readonly latestRevisionId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

function validateDocument(value: unknown): SearchDocument {
	try {
		const document = parseSearchDocument(value);
		resolveSearchDocument(document);
		return document;
	} catch (cause) {
		if (cause instanceof InvalidSearch) throw cause;
		throw new InvalidSearch(cause instanceof Error ? cause.message : "Invalid Search document");
	}
}

function filterValues(filter: SearchFilter): readonly SearchScalar[] {
	if (filter.field === "realm-tag-vote") return [];
	if ("values" in filter) return filter.values;
	if ("value" in filter) return [filter.value];
	return [filter.lower, filter.upper].filter(
		(value): value is SearchScalar => value !== undefined,
	);
}

async function ensureDocumentReferences(
	tx: DatabaseTransaction,
	document: SearchDocument,
): Promise<void> {
	const labelIds = new Set(
		[
			...document.controls.map((control) => control.labelUnitId),
			...document.sections.map((section) => section.labelUnitId),
		].filter((id): id is string => Boolean(id)),
	);
	const tagIds = new Set<string>();
	const realmIds = new Set<string>();
	for (const control of document.controls)
		if (control.field === "tag" && control.optionPolicy?.kind !== "all")
			for (const value of control.optionPolicy?.values ?? [])
				if (typeof value === "string") tagIds.add(value);
	for (const filter of document.defaults.map((value) => value.filter))
		if (filter.field === "realm-tag-vote") {
			realmIds.add(filter.realmId);
			tagIds.add(filter.tagId);
		} else if (filter.field === "tag")
			for (const value of filterValues(filter))
				if (typeof value === "string") tagIds.add(value);
	const filterUnitIds = document.filter ? collectUnitFilterReferenceIds(document.filter) : [];
	const ids = [...new Set([...labelIds, ...tagIds, ...realmIds, ...filterUnitIds])];
	if (!ids.length) return;
	const records = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
		})
		.from(unit)
		.where(and(inArray(unit.id, ids), isNull(unit.deletedAt)));
	const recordById = new Map(records.map((record) => [record.id, record]));
	const isPublicKind = (id: string, kind: "label" | "realm" | "tag") => {
		const record = recordById.get(id);
		return (
			record?.kind === kind &&
			record.status === "published" &&
			record.visibility === "public" &&
			record.moderationStatus === "approved"
		);
	};
	const isPublicUnit = (id: string) => {
		const record = recordById.get(id);
		return (
			record?.status === "published" &&
			record.visibility === "public" &&
			record.moderationStatus === "approved"
		);
	};
	if ([...labelIds].some((id) => !isPublicKind(id, "label")))
		throw new InvalidSearch(
			"Search document label references must target public active Label Units",
		);
	if ([...tagIds].some((id) => !isPublicKind(id, "tag")))
		throw new InvalidSearch("Search document tag options must target public active Tag Units");
	if ([...realmIds].some((id) => !isPublicKind(id, "realm")))
		throw new InvalidSearch(
			"Search document Realm references must target public active Realms",
		);
	if (filterUnitIds.some((id) => !isPublicUnit(id)))
		throw new InvalidSearch(
			"Search document Filter references must target public active Units",
		);
}

export async function getZoneSearchFeature(
	tx: DatabaseTransaction,
	zoneId: string,
): Promise<ZoneSearchFeatureProjection | null> {
	const [record] = await tx
		.select({
			zoneId: zoneSearchFeature.zoneId,
			searchDocumentId: zoneSearchFeature.searchDocumentId,
			enabled: zoneSearchFeature.enabled,
			document: searchDocument.document,
			latestRevisionId: searchDocumentRevisionHead.revisionId,
			createdAt: zoneSearchFeature.createdAt,
			updatedAt: zoneSearchFeature.updatedAt,
		})
		.from(zoneSearchFeature)
		.innerJoin(
			searchDocument,
			and(
				eq(searchDocument.id, zoneSearchFeature.searchDocumentId),
				isNull(searchDocument.deletedAt),
			),
		)
		.innerJoin(
			searchDocumentRevisionHead,
			eq(searchDocumentRevisionHead.searchDocumentId, searchDocument.id),
		)
		.where(eq(zoneSearchFeature.zoneId, zoneId))
		.limit(1);
	if (!record) return null;
	return { ...record, document: validateDocument(record.document) };
}

export interface PutZoneSearchFeatureInput {
	readonly zoneId: string;
	readonly enabled: boolean;
	readonly document: SearchDocument;
	readonly baseRevisionId?: string;
	readonly actorProfileId: string;
	readonly message?: string;
}

/**
 * Reconciles a Zone Search Feature inside an existing domain transaction.
 *
 * Bootstrap uses this entry point so its complete official graph remains
 * atomic. Request-facing callers use `putZoneSearchFeature`, which owns the
 * transaction boundary.
 */
export async function putZoneSearchFeatureInTransaction(
	tx: DatabaseTransaction,
	input: PutZoneSearchFeatureInput,
): Promise<ZoneSearchFeatureProjection> {
	const document = validateDocument(input.document);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`zone-search:${input.zoneId}`}::text, 0))`,
	);
	const [zoneRecord] = await tx
		.select({ id: zone.id })
		.from(zone)
		.where(eq(zone.id, input.zoneId))
		.limit(1);
	if (!zoneRecord) throw new UnitNotFound("Zone");
	await ensureDocumentReferences(tx, document);
	const current = await getZoneSearchFeature(tx, input.zoneId);
	if (!current) {
		if (input.baseRevisionId) throw new SearchDocumentRevisionConflict(null);
		const [created] = await tx.insert(searchDocument).values({ document }).returning();
		if (!created) throw new Error("SearchDocument insertion returned no row");
		const revision = await createSearchDocumentHistory(tx, {
			searchDocumentId: created.id,
			document,
			actorProfileId: input.actorProfileId,
			message: input.message,
		});
		await tx.insert(zoneSearchFeature).values({
			zoneId: input.zoneId,
			searchDocumentId: created.id,
			enabled: input.enabled,
		});
		const saved = await getZoneSearchFeature(tx, input.zoneId);
		if (!saved || saved.latestRevisionId !== revision.revisionId)
			throw new Error("Zone Search Feature creation produced an inconsistent projection");
		return saved;
	}

	if (!input.baseRevisionId || input.baseRevisionId !== current.latestRevisionId)
		throw new SearchDocumentRevisionConflict(current.latestRevisionId);
	const documentChanged = !isDeepStrictEqual(current.document, document);
	let revisionId = current.latestRevisionId;
	if (documentChanged) {
		const revision = await updateSearchDocumentHistory(tx, {
			searchDocumentId: current.searchDocumentId,
			document,
			baseRevisionId: current.latestRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
		});
		revisionId = revision.revisionId;
		await tx
			.update(searchDocument)
			.set({ document, updatedAt: new Date() })
			.where(eq(searchDocument.id, current.searchDocumentId));
	}
	if (current.enabled !== input.enabled)
		await tx
			.update(zoneSearchFeature)
			.set({ enabled: input.enabled, updatedAt: new Date() })
			.where(eq(zoneSearchFeature.zoneId, input.zoneId));
	const saved = await getZoneSearchFeature(tx, input.zoneId);
	if (!saved || saved.latestRevisionId !== revisionId)
		throw new Error("Zone Search Feature update produced an inconsistent projection");
	return saved;
}

export async function putZoneSearchFeature(
	input: PutZoneSearchFeatureInput,
): Promise<ZoneSearchFeatureProjection> {
	return database.transaction((tx) => putZoneSearchFeatureInTransaction(tx, input));
}

export async function listZoneSearchFeatureRevisions(tx: DatabaseTransaction, zoneId: string) {
	const feature = await getZoneSearchFeature(tx, zoneId);
	if (!feature) return null;
	return {
		feature,
		items: await listSearchDocumentRevisions(tx, feature.searchDocumentId),
	};
}

export async function restoreZoneSearchFeature(input: {
	readonly zoneId: string;
	readonly sourceRevisionId: string;
	readonly baseRevisionId: string;
	readonly actorProfileId: string;
	readonly message?: string;
}): Promise<ZoneSearchFeatureProjection> {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-search:${input.zoneId}`}::text, 0))`,
		);
		const feature = await getZoneSearchFeature(tx, input.zoneId);
		if (!feature) throw new InvalidSearch("Zone Search Feature is not configured");
		if (feature.latestRevisionId !== input.baseRevisionId)
			throw new SearchDocumentRevisionConflict(feature.latestRevisionId);
		const state = await getSearchDocumentRevisionState(tx, {
			searchDocumentId: feature.searchDocumentId,
			revisionId: input.sourceRevisionId,
		});
		validateDocument(state.document);
		await ensureDocumentReferences(tx, state.document);
		const revision = await restoreSearchDocumentHistory(tx, {
			searchDocumentId: feature.searchDocumentId,
			sourceRevisionId: input.sourceRevisionId,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
			message: input.message,
		});
		await tx
			.update(searchDocument)
			.set({ document: state.document, updatedAt: new Date() })
			.where(eq(searchDocument.id, feature.searchDocumentId));
		const saved = await getZoneSearchFeature(tx, input.zoneId);
		if (!saved || saved.latestRevisionId !== revision.revisionId)
			throw new Error("Zone Search Feature restore produced an inconsistent projection");
		return saved;
	});
}

export async function assertZoneSearchFeatureRevision(
	tx: DatabaseTransaction,
	searchDocumentId: string,
	baseRevisionId: string,
): Promise<void> {
	const latest = await getSearchDocumentRevisionId(tx, searchDocumentId);
	if (latest !== baseRevisionId) throw new SearchDocumentRevisionConflict(latest);
}
