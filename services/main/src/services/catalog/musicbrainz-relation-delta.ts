import { isDeepStrictEqual } from "node:util";
import { and, eq, ne, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { MusicBrainzRelationSchema } from "./musicbrainz";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";
import type { recordCatalogSourceDocument } from "./source-observations";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import { restoreCatalogSemanticRevision, transitionCatalogSemanticState } from "./semantic-history";
import type { CatalogSourceNativeChange } from "./source-applications";

type Relation = z.infer<typeof MusicBrainzRelationSchema>;
type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type Semantic = { id: string; semanticId: string; expectedHeadVersion: number };

import { correlateMusicBrainzRelations } from "./musicbrainz-relation-plan";

/** @internal Relations and their private qualifier facts form one exact source-owned revision bundle. */
export async function applyMusicBrainzRelationDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	observation: Observation,
	previous: { snapshotId: string; mappingKey: string; relations: readonly Relation[] },
	incomingInput: readonly Relation[],
) {
	const incoming = z.array(MusicBrainzRelationSchema).max(128).parse(incomingInput);
	const prior = z.array(MusicBrainzRelationSchema).max(128).parse(previous.relations);
	const correspondence = correlateMusicBrainzRelations(prior, incoming);
	const table = CatalogFactTables[reference.owner];
	const changes: CatalogSourceNativeChange[] = [];
	const sourceRevision = (value: Semantic) => value.expectedHeadVersion + 1;
	const currentRevision = (value: Semantic) =>
		resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId: observation.record.id, mappingKey: previous.mappingKey },
			{
				kind: "catalog-semantic",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: value.semanticId,
			},
			sourceRevision(value),
		);
	const record = (value: Semantic, beforeRevision: number | null, afterRevision: number) => {
		if (changes.length >= 128)
			throw new RangeError("Relationship revision bundle requires staged source application");
		changes.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: value.semanticId,
			beforeRevision,
			afterRevision,
		});
	};
	const relationAt = async (snapshotId: string, index: number) => {
		const rows = await tx
			.select({
				id: table.relation.id,
				semanticId: table.relation.semanticId,
				expectedHeadVersion: table.relation.expectedHeadVersion,
			})
			.from(table.support)
			.innerJoin(
				table.relation,
				and(
					eq(table.relation.ownerId, table.support.ownerId),
					eq(table.relation.id, table.support.relationId),
				),
			)
			.where(
				and(
					eq(table.support.ownerId, reference.id),
					eq(table.support.sourceRecordId, observation.record.id),
					eq(table.support.snapshotId, snapshotId),
					eq(table.support.sourcePath, `/relations/${index}`),
				),
			)
			.limit(2);
		if (rows.length > 1) throw new TypeError("Relationship source occurrence is ambiguous");
		return rows[0];
	};
	const qualifierFacts = async (relation: Semantic) =>
		tx
			.select({
				id: table.fact.id,
				semanticId: table.fact.semanticId,
				expectedHeadVersion: table.fact.expectedHeadVersion,
			})
			.from(table.relationScope)
			.innerJoin(
				table.fact,
				and(
					eq(table.fact.ownerId, table.relationScope.ownerId),
					eq(table.fact.id, table.relationScope.valueFactId),
				),
			)
			.where(
				and(
					eq(table.relationScope.ownerId, reference.id),
					eq(table.relationScope.relationId, relation.id),
				),
			)
			.orderBy(table.relationScope.id)
			.limit(65);
	const remove = async (value: Semantic, kind: "fact" | "relation") => {
		const independent = await tx
			.select({ id: table.support.id })
			.from(table.support)
			.where(
				and(
					eq(table.support.ownerId, reference.id),
					kind === "fact"
						? eq(table.support.factId, value.id)
						: eq(table.support.relationId, value.id),
					ne(table.support.sourceRecordId, observation.record.id),
					isNull(table.support.withdrawnAt),
				),
			)
			.limit(1);
		if (independent.length) return;
		const expected = await currentRevision(value);
		const removed = await transitionCatalogSemanticState(
			tx,
			reference,
			actor,
			revision,
			value.semanticId,
			expected,
			"superseded",
		);
		revision = removed.revision;
		record(value, expected, removed.headVersion);
	};
	const restore = async (value: Semantic) => {
		const expected = await currentRevision(value);
		const restored = await restoreCatalogSemanticRevision(
			tx,
			reference,
			actor,
			revision,
			value.semanticId,
			expected,
			sourceRevision(value),
		);
		revision = restored.revision;
		record(value, expected, restored.headVersion);
	};
	const used = new Set<number>();
	for (const [index, relation] of incoming.entries()) {
		const oldIndex = correspondence[index];
		const old = oldIndex == null ? undefined : await relationAt(previous.snapshotId, oldIndex);
		if (oldIndex != null && !old)
			throw new TypeError("Relationship update lacks its exact original occurrence");
		if (oldIndex != null) used.add(oldIndex);
		const target = await relationAt(observation.snapshot.id, index);
		if (old && oldIndex != null && isDeepStrictEqual(prior[oldIndex], relation)) {
			if (target && target.id !== old.id)
				throw new TypeError("Unchanged relationship occurrence changed its native identity");
			if (!target)
				await tx.insert(table.support).values({
					ownerId: reference.id,
					relationId: old.id,
					sourceRecordId: observation.record.id,
					snapshotId: observation.snapshot.id,
					sourcePath: `/relations/${index}`,
				});
			continue;
		}
		if (old) for (const fact of await qualifierFacts(old)) await remove(fact, "fact");
		if (target) {
			if (old && old.semanticId !== target.semanticId)
				throw new TypeError("Relationship correspondence changed its native semantic identity");
			for (const fact of await qualifierFacts(target)) await restore(fact);
			await restore(target);
			continue;
		}
		const expected = old ? await currentRevision(old) : null;
		revision = await adoptMusicBrainzRelations(
			tx,
			actor,
			reference,
			revision,
			observation,
			[relation],
			"/relations",
			index,
			old && expected !== null
				? { semanticId: old.semanticId, expectedHeadVersion: expected }
				: undefined,
		);
		const added = await relationAt(observation.snapshot.id, index);
		if (!added) throw new Error("Relationship adoption omitted its source occurrence");
		const facts = await qualifierFacts(added);
		if (facts.length > 64)
			throw new RangeError("Relationship qualifier bundle exceeds its canonical bound");
		for (const fact of facts) {
			await tx.insert(table.support).values({
				ownerId: reference.id,
				factId: fact.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: `/relations/${index}`,
			});
			record(fact, null, sourceRevision(fact));
		}
		record(added, expected, sourceRevision(added));
	}
	for (const [index] of prior.entries()) {
		if (used.has(index)) continue;
		const old = await relationAt(previous.snapshotId, index);
		if (!old) throw new TypeError("Removed relationship lacks its original source occurrence");
		await remove(old, "relation");
		for (const fact of await qualifierFacts(old)) await remove(fact, "fact");
	}
	return { revision, changes };
}
