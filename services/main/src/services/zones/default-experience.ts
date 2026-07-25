import {
	ZonePageBlockHostPolicy,
	assertUnitReferencedBlockDocument,
	createBlockKey,
	createUnitReferencedBlockDocument,
	walkBlockTree,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { ZoneHomePageSlug } from "@rezics/slug";
import { sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unitAccessBinding, unitLocalization, zonePage } from "../database/schema";
import { createContentStructure, insertContentStructureNode } from "../content-structure/service";
import { fractionalPositionAt } from "../ordering/position";
import { getZoneSearchFeature, putZoneSearchFeatureInTransaction } from "../search/documents";
import { createDefaultSearchDocument } from "../search/templates";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { getZonePageStructureProjection, listZonePageUnits } from "./pages";

export interface ProvisionZoneDefaultExperienceInput {
	readonly zoneId: string;
	readonly actorProfileId: string;
	readonly language: ContentLanguage;
	readonly title: string;
}

async function createDefaultFeedPage(
	tx: DatabaseTransaction,
	input: ProvisionZoneDefaultExperienceInput,
	useHomeSlug: boolean,
): Promise<string> {
	const pageDocument = createUnitReferencedBlockDocument([
		{
			_type: "feed",
			_key: createBlockKey(),
			feature: { kind: "zone" },
			presentation: { pagination: "load-more", showResultCount: true },
		},
	]);
	assertUnitReferencedBlockDocument(pageDocument, ZonePageBlockHostPolicy);
	const page = await insertUnit(tx, {
		kind: "zone_page",
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	await tx.insert(zonePage).values({ id: page.id, zoneId: input.zoneId });
	if (useHomeSlug)
		await replaceZonePageSlugAddress(tx, {
			zoneId: input.zoneId,
			pageUnitId: page.id,
			slug: ZoneHomePageSlug,
		});
	await tx.insert(unitLocalization).values({
		unitId: page.id,
		language: input.language,
		title: input.title,
		content: pageDocument,
		contentStatus: "published",
	});
	await tx.insert(unitAccessBinding).values({
		unitId: page.id,
		subjectKind: "profile",
		profileId: input.actorProfileId,
		role: "owner",
		scope: [],
		grantedByProfileId: input.actorProfileId,
	});
	await recordUnitRevision(tx, {
		unitId: page.id,
		actorProfileId: input.actorProfileId,
		event: "create",
		message: "Create default Zone Feed Page",
	});
	const currentStructure = await getZonePageStructureProjection(tx, input.zoneId);
	const createdStructure = currentStructure
		? null
		: await createContentStructure(tx, {
				ownerUnitId: input.zoneId,
				kind: "page-structure",
				actorProfileId: input.actorProfileId,
				message: "Create default Zone page structure",
			});
	const structure = currentStructure ?? {
		id: createdStructure!.structure.id,
		latestRevisionId: createdStructure!.revisionId,
	};
	await insertContentStructureNode(tx, {
		ownerUnitId: input.zoneId,
		structureId: structure.id,
		baseRevisionId: structure.latestRevisionId,
		actorProfileId: input.actorProfileId,
		contentUnitId: page.id,
		parentId: null,
		position: fractionalPositionAt(0),
		message: "Place default Zone Feed Page",
	});
	return page.id;
}

/**
 * Establishes the minimum usable Zone graph in the caller's transaction.
 *
 * A Zone is never committed without an enabled SearchDocument and a reachable
 * home Zone Page containing a Feed Block.
 */
export async function provisionZoneDefaultExperienceInTransaction(
	tx: DatabaseTransaction,
	input: ProvisionZoneDefaultExperienceInput,
): Promise<{ readonly pageId: string; readonly searchDocumentId: string }> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
	);
	const searchFeature = await putZoneSearchFeatureInTransaction(tx, {
		zoneId: input.zoneId,
		enabled: true,
		document: createDefaultSearchDocument("global"),
		actorProfileId: input.actorProfileId,
		message: "Create default Zone Search Feature",
	});
	const pageId = await createDefaultFeedPage(tx, input, true);
	return { pageId, searchDocumentId: searchFeature.searchDocumentId };
}

/** Idempotently repairs the minimum experience for a pre-existing Zone. */
export async function ensureZoneDefaultExperienceInTransaction(
	tx: DatabaseTransaction,
	input: ProvisionZoneDefaultExperienceInput,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
	);
	const searchFeature = await getZoneSearchFeature(tx, input.zoneId);
	if (!searchFeature?.enabled)
		await putZoneSearchFeatureInTransaction(tx, {
			zoneId: input.zoneId,
			enabled: true,
			document: searchFeature?.document ?? createDefaultSearchDocument("global"),
			...(searchFeature ? { baseRevisionId: searchFeature.latestRevisionId } : {}),
			actorProfileId: input.actorProfileId,
			message: "Repair required Zone Search Feature",
		});
	const pages = await listZonePageUnits(tx, input.zoneId, input.language);
	const hasFeed = pages.some((page) => {
		if (!page.placement) return false;
		let found = false;
		walkBlockTree(page.document, (block) => {
			if (block._type === "feed") found = true;
		});
		return found;
	});
	if (!hasFeed)
		await createDefaultFeedPage(
			tx,
			input,
			!pages.some((page) => page.slug === ZoneHomePageSlug),
		);
}
