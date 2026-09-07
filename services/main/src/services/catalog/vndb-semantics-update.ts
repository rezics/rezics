import {
	resolveCatalogSourceChildCorrespondence,
	type CatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import type { recordCatalogSourceDocument } from "./source-observations";
import type { CatalogSourceNativeChange } from "./source-applications";
import { CatalogRevisionConflict } from "./storage";
import { restoreCatalogSemanticRevision, transitionCatalogSemanticState } from "./semantic-history";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import { appendVndbSemanticPlan, vndbSemanticKeys, vndbSemanticSupportId } from "./vndb-semantics";
import type { VndbSemanticPlan } from "./vndb-semantics-contracts";

type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type Origin = { id: string; semanticId: string; headVersion: number; kind: "fact" | "relation" };
function units(plan: VndbSemanticPlan) {
	const keys = vndbSemanticKeys(plan);
	const result = new Map<string, { kind: "fact" | "relation"; value: unknown }>();
	const scalar = (fact: VndbSemanticPlan["facts"][number]) => [
		fact.namespace,
		fact.key,
		fact.kind,
		fact.value,
		fact.spoiler ?? 0,
	];
	plan.facts.forEach((fact, index) => {
		const key = keys.facts[index];
		if (!key) throw new Error("Missing semantic key");
		result.set(key, { kind: "fact", value: scalar(fact) });
	});
	plan.relations.forEach((relation, index) => {
		const key = keys.relations[index];
		if (!key) throw new Error("Missing relation key");
		result.set(key, {
			kind: "relation",
			value: [
				relation.key,
				relation.spoiler,
				relation.participants.map((participant) => [
					participant.role,
					participant.target.owner,
					participant.target.shape,
					participant.target.objectType,
					participant.target.externalId,
				]),
				relation.qualifiers.map(scalar),
			],
		});
		relation.qualifiers.forEach((qualifier, position) => {
			const child = keys.qualifiers[index]?.[position];
			if (!child) throw new Error("Missing qualifier key");
			result.set(child, { kind: "fact", value: scalar(qualifier) });
		});
	});
	return result;
}

async function sourceOrigin(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	document: Document,
	sourceKey: string,
	kind: "fact" | "relation",
	scope: CatalogSourceChildCorrespondence,
): Promise<Origin | null> {
	const t = CatalogFactTables[reference.owner];
	const value = kind === "fact" ? t.fact : t.relation;
	const target = kind === "fact" ? t.support.factId : t.support.relationId;
	const [row] = await tx
		.select({ id: value.id, semanticId: value.semanticId, previous: value.expectedHeadVersion })
		.from(t.support)
		.innerJoin(value, and(eq(value.ownerId, t.support.ownerId), eq(value.id, target)))
		.where(
			and(
				eq(t.support.ownerId, reference.id),
				eq(t.support.id, vndbSemanticSupportId(document, sourceKey, scope)),
				eq(t.support.sourceRecordId, document.record.id),
				eq(t.support.snapshotId, document.snapshot.id),
			),
		)
		.limit(1);
	return row
		? { id: row.id, semanticId: row.semanticId, headVersion: row.previous + 1, kind }
		: null;
}

/** @internal Atomic bounded semantic delta; source array reordering does not reidentify native relationships. */
export async function reconcileVndbSemanticPlan(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	mappingKey: string,
	before: { plan: VndbSemanticPlan; document: Document },
	after: { plan: VndbSemanticPlan; document: Document },
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, after.document.record.id);
	const previous = units(before.plan),
		next = units(after.plan);
	const changed =
		[...next].filter(([key, value]) => !isDeepStrictEqual(value, previous.get(key))).length +
		[...previous.keys()].filter((key) => !next.has(key)).length;
	if (changed > 128)
		throw new RangeError("VNDB semantic delta requires a staged source application");
	const changes: CatalogSourceNativeChange[] = [];
	const reuse = new Map<string, Origin>();
	const replacements = new Map<string, { semanticId: string; headVersion: number }>();
	let revision = expectedRevision;
	const expectedHead = async (origin: Origin) => {
		const expected = await resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId: before.document.record.id, mappingKey },
			{
				kind: "catalog-semantic",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: origin.semanticId,
			},
			origin.headVersion,
		);
		const t = CatalogFactTables[reference.owner].semanticHead;
		const [head] = await tx
			.select({ version: t.version })
			.from(t)
			.where(and(eq(t.ownerId, reference.id), eq(t.semanticId, origin.semanticId)))
			.limit(1);
		if (head?.version !== expected)
			throw new CatalogRevisionConflict("VNDB semantic occurrence has independent native edits");
		return expected;
	};
	for (const [key, unit] of next) {
		const old = previous.get(key);
		const prior = old
			? await sourceOrigin(tx, reference, before.document, key, old.kind, scope)
			: null;
		if (old && !prior)
			throw new Error("Previous VNDB semantic occurrence is missing its native evidence");
		if (prior && isDeepStrictEqual(old, unit)) {
			reuse.set(key, prior);
			continue;
		}
		const current = await sourceOrigin(tx, reference, after.document, key, unit.kind, scope);
		if (current) {
			if (prior && prior.semanticId !== current.semanticId)
				throw new CatalogRevisionConflict(
					"One VNDB snapshot maps this occurrence to another native semantic identity",
				);
			const expected = await expectedHead(prior ?? current);
			const restored = await restoreCatalogSemanticRevision(
				tx,
				reference,
				actor,
				revision,
				current.semanticId,
				expected,
				current.headVersion,
			);
			revision = restored.revision;
			changes.push({
				kind: "catalog-semantic",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: current.semanticId,
				beforeRevision: expected,
				afterRevision: restored.headVersion,
			});
			reuse.set(key, current);
		} else if (prior)
			replacements.set(key, {
				semanticId: prior.semanticId,
				headVersion: await expectedHead(prior),
			});
	}
	revision = await appendVndbSemanticPlan(
		tx,
		reference,
		actor,
		revision,
		after.plan,
		after.document,
		{ reuse, replacements, changes },
	);
	const removed = [...previous]
		.filter(([key]) => !next.has(key))
		.sort((a, b) => (a[1].kind === "relation" ? 0 : 1) - (b[1].kind === "relation" ? 0 : 1));
	for (const [key, unit] of removed) {
		const prior = await sourceOrigin(tx, reference, before.document, key, unit.kind, scope);
		if (!prior) throw new Error("Removed VNDB semantic occurrence has no native evidence");
		const expected = await expectedHead(prior);
		const result = await transitionCatalogSemanticState(
			tx,
			reference,
			actor,
			revision,
			prior.semanticId,
			expected,
			"superseded",
		);
		revision = result.revision;
		changes.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: prior.semanticId,
			beforeRevision: expected,
			afterRevision: result.headVersion,
		});
	}
	return { revision, changes };
}
