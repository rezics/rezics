import {
	resolveCatalogSourceChildCorrespondence,
	type CatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { softwareParticipationSourceOccurrence as occurrences } from "../database/schema/catalog-software";
import { softwareSourceContextBaseline } from "../database/schema/catalog-source-owned-baseline";
import type { CatalogReference } from "./contracts";
import type { CatalogSourceNativeChange } from "./source-applications";
import type { recordCatalogSourceDocument } from "./source-observations";
import {
	createSoftwareParticipationContext,
	readSoftwareParticipationContext,
	restoreSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
} from "./software-contexts";
import { CatalogRevisionConflict } from "./storage";
import { VndbVnSchema, vndbLanguage } from "./vndb";

type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type Edition = NonNullable<z.output<typeof VndbVnSchema>["editions"]>[number];
export type VndbNativeContext = { id: string; revision: number };
export function vndbContextValueKey(edition: Edition) {
	return JSON.stringify([
		edition.name || null,
		edition.lang === null ? null : vndbLanguage(edition.lang),
	]);
}

async function snapshotContexts(
	tx: DatabaseTransaction,
	content: CatalogReference,
	document: Document,
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, document.record.id);
	const rows = await tx
		.select()
		.from(occurrences)
		.where(
			and(
				eq(occurrences.sourceRecordId, document.record.id),
				eq(occurrences.mappingKey, scope.mappingKey),
				eq(occurrences.correspondenceRevision, scope.correspondenceRevision),
				eq(occurrences.snapshotId, document.snapshot.id),
				eq(occurrences.contentId, content.id),
				eq(occurrences.namespace, "editions"),
			),
		)
		.limit(129);
	if (rows.length > 128) throw new RangeError("VNDB context snapshot exceeds its source contract");
	return new Map(rows.map((row) => [row.localKey, row]));
}
async function currentExpected(
	tx: DatabaseTransaction,
	content: CatalogReference,
	document: Document,
	scope: CatalogSourceChildCorrespondence,
	context: VndbNativeContext,
) {
	const t = softwareSourceContextBaseline;
	const [baseline] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, document.record.id),
				eq(t.mappingKey, scope.mappingKey),
				eq(t.correspondenceRevision, scope.correspondenceRevision),
				eq(t.ownerId, content.id),
				eq(t.componentKey, context.id),
			),
		)
		.limit(1);
	return baseline?.sourceRevision === context.revision
		? baseline.currentRevision
		: context.revision;
}

/** @internal Only unchanged or unambiguously equal contextual values reuse identity; VN-local eid alone never matches revisions. */
export async function reconcileVndbContexts(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	mappingKey: string,
	before: { record: z.output<typeof VndbVnSchema> | null; document: Document },
	after: { record: z.output<typeof VndbVnSchema>; document: Document },
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, after.document.record.id);
	if (scope.mappingKey !== mappingKey) throw new Error("VNDB context root mapping differs");
	const oldRows = before.record
		? await snapshotContexts(tx, content, before.document)
		: new Map<string, typeof occurrences.$inferSelect>();
	const incomingRows = await snapshotContexts(tx, content, after.document);
	const oldEditions = before.record?.editions ?? [],
		nextEditions = after.record.editions ?? [];
	const identical = isDeepStrictEqual(oldEditions, nextEditions);
	const groups = new Map<string, Edition[]>();
	for (const edition of oldEditions) {
		const key = vndbContextValueKey(edition);
		groups.set(key, [...(groups.get(key) ?? []), edition]);
	}
	const oldContexts = new Map<string, VndbNativeContext>();
	for (const edition of oldEditions) {
		const row = oldRows.get(String(edition.eid));
		if (!row) throw new Error("VNDB context has no exact previous source occurrence");
		oldContexts.set(String(edition.eid), {
			id: row.contextId,
			revision: row.contextRevision,
		});
	}
	const nextContexts = new Map<string, VndbNativeContext>(),
		retained = new Set<string>(),
		changes: CatalogSourceNativeChange[] = [];
	for (const [index, edition] of nextEditions.entries()) {
		const key = String(edition.eid),
			incoming = incomingRows.get(key);
		const candidates = groups.get(vndbContextValueKey(edition)) ?? [];
		const matched = identical
			? oldEditions.find((item) => item.eid === edition.eid)
			: candidates.length === 1
				? candidates[0]
				: undefined;
		const previous = matched ? oldContexts.get(String(matched.eid)) : undefined;
		let context: VndbNativeContext;
		if (previous && !retained.has(previous.id)) {
			context = previous;
			retained.add(previous.id);
		} else if (incoming) {
			context = { id: incoming.contextId, revision: incoming.contextRevision };
			const current = await readSoftwareParticipationContext(tx, content, actor, context.id);
			const expected = await currentExpected(tx, content, after.document, scope, context);
			if (current.revision !== expected)
				throw new CatalogRevisionConflict(
					"VNDB context reappearance conflicts with an independent native edit",
				);
			if (current.state !== "active") {
				const restored = await restoreSoftwareParticipationContext(
					tx,
					content,
					actor,
					context.id,
					expected,
					context.revision,
				);
				changes.push({
					kind: "software-context",
					ownerId: content.id,
					componentKey: context.id,
					beforeRevision: expected,
					afterRevision: restored.revision,
				});
			}
		} else {
			const created = await createSoftwareParticipationContext(tx, content, actor, {
				label: edition.name || null,
				languageTag: edition.lang === null ? null : vndbLanguage(edition.lang),
				state: "active",
			});
			context = { id: created.contextId, revision: created.revision };
			changes.push({
				kind: "software-context",
				ownerId: content.id,
				componentKey: context.id,
				beforeRevision: null,
				afterRevision: created.revision,
			});
		}
		if (
			incoming &&
			(incoming.contextId !== context.id || incoming.contextRevision !== context.revision)
		)
			throw new CatalogRevisionConflict("VNDB immutable context correspondence differs");
		if (!incoming)
			await tx.insert(occurrences).values({
				...scope,
				sourceRecordId: after.document.record.id,
				snapshotId: after.document.snapshot.id,
				namespace: "editions",
				localKey: key,
				contentId: content.id,
				contextId: context.id,
				contextRevision: context.revision,
				sourcePointer: `/editions/${index}`,
				sourceLabel: edition.name,
				sourceLanguage: edition.lang,
				sourceLanguageTag: edition.lang === null ? null : vndbLanguage(edition.lang),
				sourceClaimedOfficial: edition.official,
			});
		nextContexts.set(key, context);
	}
	const retire = async () => {
		const retired: CatalogSourceNativeChange[] = [];
		for (const previous of oldContexts.values()) {
			if (
				retained.has(previous.id) ||
				[...nextContexts.values()].some((value) => value.id === previous.id)
			)
				continue;
			const expected = await currentExpected(tx, content, before.document, scope, previous);
			const current = await readSoftwareParticipationContext(tx, content, actor, previous.id);
			if (current.revision !== expected) continue; // Independently curated groups remain canonical objects.
			const updated = await reviseSoftwareParticipationContext(
				tx,
				content,
				actor,
				previous.id,
				expected,
				{
					label: current.label,
					languageTag: current.languageTag,
					state: "withdrawn",
				},
			);
			retired.push({
				kind: "software-context",
				ownerId: content.id,
				componentKey: previous.id,
				beforeRevision: expected,
				afterRevision: updated.revision,
			});
		}
		return retired;
	};
	return { oldContexts, nextContexts, changes, retire };
}
