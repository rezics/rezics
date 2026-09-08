import { and, eq, isNull, ne, or } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogReferenceSchema, type CatalogReference } from "./contracts";
import { createCatalogRelation, loadCatalogIdentity } from "./storage";
import { catalogSourceSupportColumns } from "./source-support";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import { restoreCatalogSemanticRevision, transitionCatalogSemanticState } from "./semantic-history";
import type { CatalogSourceNativeChange } from "./source-applications";
import type { recordCatalogSourceDocument } from "./source-observations";

/** Resolved native participants and governed qualifier facts; external IDs never enter native relation targets. @internal */
export const CatalogSourceRelationDescriptorSchema = z.strictObject({
	identity: z.string().min(1).max(1024),
	path: z.string().startsWith("/").max(512),
	value: z.strictObject({
		definitionRevisionId: z.uuid(),
		spoiler: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
		participants: z
			.array(
				z.strictObject({
					roleRevisionId: z.uuid(),
					target: CatalogReferenceSchema,
					creditedAs: z.string().max(131072).optional(),
				}),
			)
			.min(1)
			.max(128),
		qualifiers: z
			.array(z.strictObject({ definitionRevisionId: z.uuid(), valueFactId: z.uuid() }))
			.max(64)
			.default([]),
	}),
});
export type CatalogSourceRelationDescriptor = z.input<typeof CatalogSourceRelationDescriptorSchema>;

/** Read only the owning relation's immutable occurrence; previous private participants need no live remapping. @internal */
export async function readCatalogSourceRelationDescriptor(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	input: { sourceRecordId: string; snapshotId: string; identity: string; path: string },
): Promise<CatalogSourceRelationDescriptor | null> {
	await loadCatalogIdentity(tx, reference, actor, true);
	z.uuid().parse(input.sourceRecordId);
	z.uuid().parse(input.snapshotId);
	const f = CatalogFactTables[reference.owner],
		scope = await catalogSourceSupportColumns(tx, input.sourceRecordId);
	const rows = await tx
		.select({
			id: f.relation.id,
			definitionRevisionId: f.relation.definitionRevisionId,
			spoiler: f.relation.spoiler,
		})
		.from(f.support)
		.innerJoin(
			f.relation,
			and(eq(f.relation.ownerId, f.support.ownerId), eq(f.relation.id, f.support.relationId)),
		)
		.where(
			and(
				eq(f.support.ownerId, reference.id),
				eq(f.support.sourceRecordId, input.sourceRecordId),
				eq(f.support.sourceMappingKey, scope.sourceMappingKey),
				eq(f.support.sourceCorrespondenceRevision, scope.sourceCorrespondenceRevision),
				eq(f.support.snapshotId, input.snapshotId),
				eq(f.support.sourcePath, input.path),
			),
		)
		.limit(2);
	if (rows.length > 1) throw new TypeError("Source relation occurrence is ambiguous");
	const row = rows[0];
	if (!row) return null;
	const participants = await tx
		.select()
		.from(f.participant)
		.where(and(eq(f.participant.ownerId, reference.id), eq(f.participant.relationId, row.id)))
		.orderBy(f.participant.position)
		.limit(129);
	const qualifiers = await tx
		.select({
			definitionRevisionId: f.relationScope.definitionRevisionId,
			valueFactId: f.relationScope.valueFactId,
		})
		.from(f.relationScope)
		.where(and(eq(f.relationScope.ownerId, reference.id), eq(f.relationScope.relationId, row.id)))
		.orderBy(f.relationScope.definitionRevisionId, f.relationScope.valueFactId)
		.limit(65);
	return CatalogSourceRelationDescriptorSchema.parse({
		identity: input.identity,
		path: input.path,
		value: {
			definitionRevisionId: row.definitionRevisionId,
			spoiler: row.spoiler,
			qualifiers,
			participants: participants.map((participant) => {
				const targets = Object.entries({
					publishing: participant.publishingId,
					music: participant.musicId,
					program: participant.programId,
					software: participant.softwareId,
					entity: participant.entityId,
					grouping: participant.groupingId,
					reference: participant.referenceId,
					distribution: participant.distributionId,
				}).filter(([, id]) => id !== null);
				if (targets.length !== 1)
					throw new TypeError("Recorded relation participant has another native target shape");
				const [target] = targets;
				if (!target) throw new TypeError("Recorded relation participant target is missing");
				return {
					roleRevisionId: participant.roleRevisionId,
					target: CatalogReferenceSchema.parse({ owner: target[0], id: target[1] }),
					...(participant.creditedAs === null ? {} : { creditedAs: participant.creditedAs }),
				};
			}),
		},
	});
}

/** @internal Stable source relation identities survive array reorder and repeated exact journal compensation. */
export async function applyCatalogSourceRelationDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	previous: {
		snapshotId: string;
		mappingKey: string;
		descriptors: readonly CatalogSourceRelationDescriptor[];
	} | null,
	incoming: readonly CatalogSourceRelationDescriptor[],
) {
	const parse = (items: readonly CatalogSourceRelationDescriptor[]) => {
		const result = z.array(CatalogSourceRelationDescriptorSchema).max(128).parse(items);
		if (
			new Set(result.map((item) => item.identity)).size !== result.length ||
			new Set(result.map((item) => item.path)).size !== result.length
		)
			throw new TypeError("Source relation identity or occurrence path is ambiguous");
		return result.map((item) => ({
			...item,
			value: {
				...item.value,
				qualifiers: [...item.value.qualifiers].sort(
					(left, right) =>
						left.definitionRevisionId.localeCompare(right.definitionRevisionId) ||
						left.valueFactId.localeCompare(right.valueFactId),
				),
			},
		}));
	};
	const before = parse(previous?.descriptors ?? []),
		after = parse(incoming);
	if (before.length + after.length > 128)
		throw new RangeError("Source relation delta requires staged application");
	const f = CatalogFactTables[reference.owner],
		scope = await catalogSourceSupportColumns(tx, document.record.id);
	if (previous && previous.mappingKey !== scope.sourceMappingKey)
		throw new TypeError("Relation delta crosses source correspondence");
	const key = { sourceRecordId: document.record.id, mappingKey: scope.sourceMappingKey };
	const changes: CatalogSourceNativeChange[] = [];
	const relations: { identity: string; relationId: string; semanticId: string }[] = [];
	const locate = async (
		snapshotId: string,
		descriptor: z.output<typeof CatalogSourceRelationDescriptorSchema>,
	) => {
		const rows = await tx
			.select({
				id: f.relation.id,
				semanticId: f.relation.semanticId,
				expectedHeadVersion: f.relation.expectedHeadVersion,
			})
			.from(f.support)
			.innerJoin(
				f.relation,
				and(eq(f.relation.ownerId, f.support.ownerId), eq(f.relation.id, f.support.relationId)),
			)
			.where(
				and(
					eq(f.support.ownerId, reference.id),
					eq(f.support.sourceRecordId, document.record.id),
					eq(f.support.sourceMappingKey, scope.sourceMappingKey),
					eq(f.support.sourceCorrespondenceRevision, scope.sourceCorrespondenceRevision),
					eq(f.support.snapshotId, snapshotId),
					eq(f.support.sourcePath, descriptor.path),
					eq(f.relation.definitionRevisionId, descriptor.value.definitionRevisionId),
				),
			)
			.limit(2);
		if (rows.length > 1)
			throw new TypeError("Source relation has more than one exact native occurrence");
		return rows[0] ?? null;
	};
	type Native = NonNullable<Awaited<ReturnType<typeof locate>>>;
	const head = (row: Native) =>
		resolveCatalogSourceOwnedBaseline(
			tx,
			key,
			{
				owner: reference.owner,
				ownerId: reference.id,
				kind: "catalog-semantic",
				componentKey: row.semanticId,
			},
			row.expectedHeadVersion + 1,
		);
	const independent = async (id: string) =>
		Boolean(
			(
				await tx
					.select({ id: f.support.id })
					.from(f.support)
					.where(
						and(
							eq(f.support.ownerId, reference.id),
							eq(f.support.relationId, id),
							or(
								ne(f.support.sourceRecordId, document.record.id),
								isNull(f.support.sourceMappingKey),
							),
							isNull(f.support.withdrawnAt),
						),
					)
					.limit(1)
			)[0],
		);
	const support = async (
		descriptor: z.output<typeof CatalogSourceRelationDescriptorSchema>,
		row: Native,
	) => {
		await tx.insert(f.support).values({
			...scope,
			ownerId: reference.id,
			relationId: row.id,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: descriptor.path,
		});
	};
	const record = (row: Native, beforeRevision: number | null, afterRevision: number) => {
		changes.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: row.semanticId,
			beforeRevision,
			afterRevision,
		});
	};
	const oldByKey = new Map(before.map((item) => [item.identity, item]));
	for (const descriptor of after) {
		const old = oldByKey.get(descriptor.identity);
		if (old && old.value.definitionRevisionId !== descriptor.value.definitionRevisionId)
			throw new TypeError(
				"Stable source relation identity changed its reviewed predicate definition",
			);
		const prior = old && previous ? await locate(previous.snapshotId, old) : null;
		if (old && !prior)
			throw new TypeError("Previous relation lacks its exact native source occurrence");
		const target = await locate(document.snapshot.id, descriptor);
		if (old && prior && isDeepStrictEqual(old.value, descriptor.value)) {
			if (target && target.semanticId !== prior.semanticId)
				throw new TypeError("Unchanged source relation changed native semantic identity");
			if (!target) await support(descriptor, prior);
			relations.push({
				identity: descriptor.identity,
				relationId: prior.id,
				semanticId: prior.semanticId,
			});
			continue;
		}
		if (target) {
			const expected = await head(prior && prior.semanticId === target.semanticId ? prior : target);
			const restored = await restoreCatalogSemanticRevision(
				tx,
				reference,
				actor,
				revision,
				target.semanticId,
				expected,
				target.expectedHeadVersion + 1,
			);
			revision = restored.revision;
			record(target, expected, restored.headVersion);
			relations.push({
				identity: descriptor.identity,
				relationId: target.id,
				semanticId: target.semanticId,
			});
			continue;
		}
		const replace = prior && !(await independent(prior.id));
		const expected = replace ? await head(prior) : null;
		const created = await createCatalogRelation(tx, reference, actor, revision, {
			...descriptor.value,
			...(replace && expected !== null
				? { semanticId: prior.semanticId, expectedHeadVersion: expected }
				: {}),
		});
		revision = created.revision;
		const native = {
			id: created.id,
			semanticId: created.semanticId,
			expectedHeadVersion: created.headVersion - 1,
		};
		await support(descriptor, native);
		record(native, expected, created.headVersion);
		relations.push({
			identity: descriptor.identity,
			relationId: created.id,
			semanticId: created.semanticId,
		});
	}
	const nextKeys = new Set(after.map((item) => item.identity));
	for (const descriptor of before) {
		if (nextKeys.has(descriptor.identity) || !previous) continue;
		const prior = await locate(previous.snapshotId, descriptor);
		if (!prior) throw new TypeError("Removed source relation lacks its exact native occurrence");
		if (await independent(prior.id)) continue;
		const expected = await head(prior);
		const removed = await transitionCatalogSemanticState(
			tx,
			reference,
			actor,
			revision,
			prior.semanticId,
			expected,
			"superseded",
		);
		revision = removed.revision;
		record(prior, expected, removed.headVersion);
	}
	return { revision, changes, relations };
}
