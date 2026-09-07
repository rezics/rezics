import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	softwareParticipation as heads,
	softwareParticipationRevision as revisions,
	softwareParticipationCreditSourceOccurrence as occurrences,
} from "../database/schema/catalog-software-participation";
import { softwareSourceParticipationBaseline } from "../database/schema/catalog-source-owned-baseline";
import type { CatalogReference } from "./contracts";
import type { CatalogSourceNativeChange } from "./source-applications";
import type { recordCatalogSourceDocument } from "./source-observations";
import {
	createSoftwareParticipation,
	reviseSoftwareParticipation,
	type SoftwareParticipationValues,
} from "./software-participation";
import {
	planVndbParticipation,
	resolveVndbParticipationValues,
	type VndbParticipationResolutionCache,
} from "./vndb-participation";
import type { VndbNativeContext } from "./vndb-contexts-update";
import type { VndbVnSchema } from "./vndb";
import { CatalogRevisionConflict } from "./storage";

type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type Row = ReturnType<typeof planVndbParticipation>[number];
function baseKey(item: Row, contexts: ReadonlyMap<string, VndbNativeContext>) {
	return JSON.stringify([
		item.characterId === null ? "staff" : "voice",
		item.staffId,
		item.aliasId,
		item.role,
		item.contextKey === null ? null : contexts.get(item.contextKey)?.id,
		item.characterId,
	]);
}
function keyed(
	rows: Row[],
	contexts: ReadonlyMap<string, VndbNativeContext>,
	counts: ReadonlyMap<string, number>,
) {
	const repetitions = new Map<string, number>();
	return new Map(
		rows.map((item) => {
			const base = baseKey(item, contexts),
				value = (counts.get(base) ?? 0) > 1 ? JSON.stringify([base, item.note || null]) : base,
				count = repetitions.get(value) ?? 0;
			repetitions.set(value, count + 1);
			return [`${value}/${count}`, item] as const;
		}),
	);
}
function values(row: typeof revisions.$inferSelect): SoftwareParticipationValues {
	return {
		entityId: row.entityId,
		name: row.nameId && row.nameRevision ? { id: row.nameId, revision: row.nameRevision } : null,
		context:
			row.contextId && row.contextRevision
				? { id: row.contextId, revision: row.contextRevision }
				: null,
		characterId: row.characterId,
		roleRevisionId: row.roleRevisionId,
		note: row.note,
		state: row.state,
	};
}

/** @internal Actor/alias/role/context keys preserve separate credits and use exact child revisions for mutations. */
export async function reconcileVndbParticipation(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	mappingKey: string,
	before: {
		record: z.output<typeof VndbVnSchema> | null;
		document: Document;
		contexts: ReadonlyMap<string, VndbNativeContext>;
	},
	after: {
		record: z.output<typeof VndbVnSchema>;
		document: Document;
		contexts: ReadonlyMap<string, VndbNativeContext>;
	},
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, after.document.record.id);
	if (scope.mappingKey !== mappingKey) throw new Error("VNDB participation root mapping differs");
	const oldRows = before.record ? planVndbParticipation(before.record) : [],
		nextRows = planVndbParticipation(after.record);
	const counts = new Map<string, number>();
	for (const [rows, contexts] of [
		[oldRows, before.contexts],
		[nextRows, after.contexts],
	] as const) {
		const local = new Map<string, number>();
		for (const item of rows) {
			const key = baseKey(item, contexts);
			local.set(key, (local.get(key) ?? 0) + 1);
		}
		for (const [key, count] of local) counts.set(key, Math.max(counts.get(key) ?? 0, count));
	}
	const previous = keyed(oldRows, before.contexts, counts),
		next = keyed(nextRows, after.contexts, counts),
		changes: CatalogSourceNativeChange[] = [];
	const cache: VndbParticipationResolutionCache = {
		targets: new Map(),
		aliases: new Map(),
		roles: new Map(),
	};
	const loadOccurrences = async (document: Document, maximum: number) => {
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
				),
			)
			.limit(maximum + 1);
		if (rows.length > maximum)
			throw new Error("Native source credit occurrences exceed the archived record");
		return new Map(rows.map((row) => [row.sourcePath, row]));
	};
	const oldOccurrences = before.record
		? await loadOccurrences(before.document, oldRows.length)
		: new Map<string, typeof occurrences.$inferSelect>();
	const incomingOccurrences = await loadOccurrences(after.document, nextRows.length);
	const sourceWrites: (typeof occurrences.$inferInsert)[] = [];
	const current = async (id: string) => {
		const [row] = await tx
			.select({ value: revisions })
			.from(heads)
			.innerJoin(
				revisions,
				and(
					eq(heads.contentId, revisions.contentId),
					eq(heads.id, revisions.participationId),
					eq(heads.currentRevision, revisions.revision),
				),
			)
			.where(and(eq(heads.contentId, content.id), eq(heads.id, id)))
			.limit(1);
		if (!row) throw new Error("Native participation head is missing");
		return row.value;
	};
	const expected = async (id: string, revision: number) => {
		const t = softwareSourceParticipationBaseline;
		const [baseline] = await tx
			.select()
			.from(t)
			.where(
				and(
					eq(t.sourceRecordId, after.document.record.id),
					eq(t.mappingKey, mappingKey),
					eq(t.correspondenceRevision, scope.correspondenceRevision),
					eq(t.ownerId, content.id),
					eq(t.componentKey, id),
				),
			)
			.limit(1);
		return baseline?.sourceRevision === revision ? baseline.currentRevision : revision;
	};
	for (const [key, item] of next) {
		const priorItem = previous.get(key),
			prior = priorItem ? oldOccurrences.get(priorItem.path) : undefined,
			incoming = incomingOccurrences.get(item.path);
		if (priorItem && !prior) throw new Error("Previous VNDB credit has no native occurrence");
		let target: { id: string; revision: number };
		const equivalent =
			priorItem &&
			isDeepStrictEqual(
				{ ...priorItem, path: null, staffPath: null, characterPath: null, contextKey: null },
				{ ...item, path: null, staffPath: null, characterPath: null, contextKey: null },
			);
		if (prior && equivalent)
			target = { id: prior.participationId, revision: prior.participationRevision };
		else {
			const context = item.contextKey === null ? null : after.contexts.get(item.contextKey);
			if (item.contextKey !== null && !context)
				throw new Error("VNDB credit context is absent from its snapshot");
			const desired = await resolveVndbParticipationValues(
				tx,
				actor,
				item,
				after.document,
				context ?? null,
				cache,
			);
			const origin = prior ?? incoming;
			if (origin) {
				const head = await current(origin.participationId),
					fence = await expected(origin.participationId, origin.participationRevision);
				if (head.revision !== fence)
					throw new CatalogRevisionConflict("VNDB credit has an independent native edit");
				const updated = await reviseSoftwareParticipation(
					tx,
					content,
					actor,
					origin.participationId,
					fence,
					desired,
				);
				changes.push({
					kind: "software-participation",
					ownerId: content.id,
					componentKey: updated.participationId,
					beforeRevision: fence,
					afterRevision: updated.revision,
				});
				target = { id: updated.participationId, revision: updated.revision };
			} else {
				const created = await createSoftwareParticipation(tx, content, actor, desired);
				changes.push({
					kind: "software-participation",
					ownerId: content.id,
					componentKey: created.participationId,
					beforeRevision: null,
					afterRevision: created.revision,
				});
				target = { id: created.participationId, revision: created.revision };
			}
		}
		if (incoming && incoming.participationId !== target.id)
			throw new CatalogRevisionConflict(
				"VNDB snapshot already maps credit to another native occurrence",
			);
		if (!incoming)
			sourceWrites.push({
				...scope,
				sourceRecordId: after.document.record.id,
				snapshotId: after.document.snapshot.id,
				sourcePath: item.path,
				contentId: content.id,
				participationId: target.id,
				participationRevision: target.revision,
			});
	}
	for (const [key, item] of previous) {
		if (next.has(key)) continue;
		const prior = oldOccurrences.get(item.path);
		if (!prior) throw new Error("Removed VNDB credit has no native occurrence");
		const fence = await expected(prior.participationId, prior.participationRevision),
			head = await current(prior.participationId);
		if (head.revision !== fence)
			throw new CatalogRevisionConflict("Removing VNDB credit would erase a native edit");
		const removed = await reviseSoftwareParticipation(
			tx,
			content,
			actor,
			prior.participationId,
			fence,
			{ ...values(head), state: "withdrawn" },
		);
		changes.push({
			kind: "software-participation",
			ownerId: content.id,
			componentKey: removed.participationId,
			beforeRevision: fence,
			afterRevision: removed.revision,
		});
	}
	for (let offset = 0; offset < sourceWrites.length; offset += 128)
		await tx.insert(occurrences).values(sourceWrites.slice(offset, offset + 128));
	return changes;
}
