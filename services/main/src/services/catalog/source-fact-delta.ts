import { catalogSourceSupportColumns } from "./source-support";
import { isDeepStrictEqual } from "node:util";
import { and, eq, ne, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import type { recordCatalogSourceDocument } from "./source-observations";
import { CatalogPartialDateSchema } from "./contracts";
import { catalogValueNodes } from "./value-nodes";
import {
	appendCatalogFactNodes,
	beginCatalogFact,
	ensureCatalogDefinition,
	sealCatalogFact,
} from "./storage";
import { transitionCatalogSemanticState, restoreCatalogSemanticRevision } from "./semantic-history";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";

const descriptorSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		identity: z.string().min(1).max(1024),
		path: z.string().startsWith("/").max(512),
		namespace: z.string().min(1).max(256),
		key: z.string().min(1).max(1024),
		value: z.string().max(131072),
		kind: z.literal("string"),
	}),
	z.strictObject({
		identity: z.string().min(1).max(1024),
		path: z.string().startsWith("/").max(512),
		namespace: z.string().min(1).max(256),
		key: z.string().min(1).max(1024),
		value: CatalogPartialDateSchema,
		kind: z.literal("object"),
	}),
]);
export type CatalogSourceFactDescriptor = z.output<typeof descriptorSchema>;

type FactChange = {
	kind: "catalog-semantic";
	owner: CatalogReference["owner"];
	ownerId: string;
	componentKey: string;
	beforeRevision: number | null;
	afterRevision: number;
};

/** @internal Complete semantic replacement and source removal preserve exact source heads and independent corrections. */
export async function applyCatalogSourceFactDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	observation: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	previous: {
		snapshotId: string;
		mappingKey: string;
		descriptors: readonly CatalogSourceFactDescriptor[];
	} | null,
	incoming: readonly CatalogSourceFactDescriptor[],
) {
	const before = previous ? previous.descriptors.map((item) => descriptorSchema.parse(item)) : [];
	const after = incoming.map((item) => descriptorSchema.parse(item));
	if (before.length + after.length > 128)
		throw new RangeError("Catalog semantic delta requires staged application");
	const f = CatalogFactTables[reference.owner];
	const scope = await catalogSourceSupportColumns(tx, observation.record.id);
	const baselineKey = {
		sourceRecordId: observation.record.id,
		mappingKey: previous?.mappingKey ?? scope.sourceMappingKey,
	};
	const changes: FactChange[] = [];
	const consumed = new Set<number>();
	const support = async (snapshotId: string, descriptor: CatalogSourceFactDescriptor) => {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: descriptor.namespace,
			key: descriptor.key,
			kind: "property",
			valueKind: descriptor.kind,
			...(descriptor.kind === "object"
				? {
						constraints: {
							rules: [
								{ position: 0, parent: null, memberKey: null, kind: "object" as const },
								{
									position: 1,
									parent: 0,
									memberKey: "year",
									kind: "number" as const,
									nullable: true,
									integer: true,
								},
								{
									position: 2,
									parent: 0,
									memberKey: "month",
									kind: "number" as const,
									nullable: true,
									integer: true,
									minimum: 1,
									maximum: 12,
								},
								{
									position: 3,
									parent: 0,
									memberKey: "day",
									kind: "number" as const,
									nullable: true,
									integer: true,
									minimum: 1,
									maximum: 31,
								},
							],
						},
					}
				: {}),
		});
		const [row] = await tx
			.select({
				factId: f.fact.id,
				semanticId: f.fact.semanticId,
				expectedHeadVersion: f.fact.expectedHeadVersion,
			})
			.from(f.support)
			.innerJoin(
				f.fact,
				and(eq(f.fact.ownerId, f.support.ownerId), eq(f.fact.id, f.support.factId)),
			)
			.where(
				and(
					eq(f.support.sourceRecordId, observation.record.id),
					eq(f.support.sourceMappingKey, scope.sourceMappingKey),
					eq(f.support.sourceCorrespondenceRevision, scope.sourceCorrespondenceRevision),
					eq(f.support.snapshotId, snapshotId),
					eq(f.support.ownerId, reference.id),
					eq(f.support.sourcePath, descriptor.path),
					eq(f.fact.definitionRevisionId, definition.revisionId),
				),
			)
			.orderBy(f.support.id)
			.limit(1);
		return { definition, row };
	};
	const independentSupport = async (factId: string) => {
		const [row] = await tx
			.select({ id: f.support.id })
			.from(f.support)
			.where(
				and(
					eq(f.support.ownerId, reference.id),
					eq(f.support.factId, factId),
					or(
						ne(f.support.sourceRecordId, observation.record.id),
						isNull(f.support.sourceMappingKey),
					),
					isNull(f.support.withdrawnAt),
				),
			)
			.limit(1);
		return Boolean(row);
	};
	for (const descriptor of after) {
		let oldIndex = before.findIndex(
			(candidate, index) =>
				!consumed.has(index) &&
				candidate.identity === descriptor.identity &&
				isDeepStrictEqual(candidate.value, descriptor.value),
		);
		if (oldIndex === -1)
			oldIndex = before.findIndex(
				(candidate, index) => !consumed.has(index) && candidate.identity === descriptor.identity,
			);
		const old = before[oldIndex];
		if (old) consumed.add(oldIndex);
		const proof =
			old && previous
				? await support(previous.snapshotId, old)
				: await support(observation.snapshot.id, descriptor);
		if (old && !proof.row) throw new Error("Catalog semantic source occurrence is missing");
		if (old && isDeepStrictEqual(old.value, descriptor.value) && proof.row) {
			const target = await support(observation.snapshot.id, descriptor);
			if (!target.row)
				await tx.insert(f.support).values({
					...(await catalogSourceSupportColumns(tx, observation.record.id)),
					ownerId: reference.id,
					factId: proof.row.factId,
					sourceRecordId: observation.record.id,
					snapshotId: observation.snapshot.id,
					sourcePath: descriptor.path,
				});
			else if (target.row.semanticId !== proof.row.semanticId)
				throw new Error("Source fact occurrence changed native semantic identity");
			continue;
		}
		const sourceRevision = proof.row ? proof.row.expectedHeadVersion + 1 : 0;
		const currentRevision = proof.row
			? await resolveCatalogSourceOwnedBaseline(
					tx,
					baselineKey,
					{
						owner: reference.owner,
						ownerId: reference.id,
						kind: "catalog-semantic",
						componentKey: proof.row.semanticId,
					},
					sourceRevision,
				)
			: sourceRevision;
		const target = await support(observation.snapshot.id, descriptor);
		if (target.row) {
			const expected =
				proof.row && proof.row.semanticId === target.row.semanticId
					? currentRevision
					: await resolveCatalogSourceOwnedBaseline(
							tx,
							baselineKey,
							{
								owner: reference.owner,
								ownerId: reference.id,
								kind: "catalog-semantic",
								componentKey: target.row.semanticId,
							},
							target.row.expectedHeadVersion + 1,
						);
			const restored = await restoreCatalogSemanticRevision(
				tx,
				reference,
				actor,
				revision,
				target.row.semanticId,
				expected,
				target.row.expectedHeadVersion + 1,
			);
			revision = restored.revision;
			changes.push({
				kind: "catalog-semantic",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: target.row.semanticId,
				beforeRevision: expected,
				afterRevision: restored.headVersion,
			});
			continue;
		}
		const replacement = proof.row && !(await independentSupport(proof.row.factId));
		const fact = await beginCatalogFact(
			tx,
			reference,
			actor,
			revision,
			target.definition.revisionId,
			replacement && proof.row
				? { semanticId: proof.row.semanticId, expectedHeadVersion: currentRevision }
				: {},
		);
		const nodes = [...catalogValueNodes(descriptor.value)];
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			fact.revision,
			fact.id,
			-1,
			nodes,
		);
		revision = (
			await sealCatalogFact(
				tx,
				reference,
				actor,
				appended.revision,
				fact.id,
				appended.lastNodePosition,
			)
		).revision;
		const [native] = await tx
			.select()
			.from(f.fact)
			.where(and(eq(f.fact.ownerId, reference.id), eq(f.fact.id, fact.id)))
			.limit(1);
		if (!native) throw new Error("Catalog semantic projection is missing");
		await tx.insert(f.support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
			ownerId: reference.id,
			factId: fact.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: descriptor.path,
		});
		changes.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: native.semanticId,
			beforeRevision: replacement ? currentRevision : null,
			afterRevision: native.expectedHeadVersion + 1,
		});
	}
	for (const [index, descriptor] of before.entries()) {
		if (consumed.has(index) || !previous) continue;
		const proof = await support(previous.snapshotId, descriptor);
		if (!proof.row) throw new Error("Removed source assertion has no exact source occurrence");
		if (await independentSupport(proof.row.factId)) continue;
		const current = await resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId: observation.record.id, mappingKey: previous.mappingKey },
			{
				owner: reference.owner,
				ownerId: reference.id,
				kind: "catalog-semantic",
				componentKey: proof.row.semanticId,
			},
			proof.row.expectedHeadVersion + 1,
		);
		const removed = await transitionCatalogSemanticState(
			tx,
			reference,
			actor,
			revision,
			proof.row.semanticId,
			current,
			"superseded",
		);
		revision = removed.revision;
		changes.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: proof.row.semanticId,
			beforeRevision: current,
			afterRevision: removed.headVersion,
		});
	}
	return { revision, changes };
}
