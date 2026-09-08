import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	catalogSourceMappingClaim as claims,
	catalogSourceBindingRevision as bindingRevisions,
	catalogSourceSnapshot as snapshots,
} from "../database/schema/catalog-source";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { softwareRecordSourceOccurrence } from "../database/schema/catalog-software-source";
import {
	softwareParticipationSourceOccurrence as contextOccurrences,
	softwareParticipationContext,
	softwareParticipationContextRevision,
} from "../database/schema/catalog-software";
import {
	softwareParticipationCreditSourceOccurrence as creditOccurrences,
	softwareParticipation as creditHeads,
	softwareParticipationRevision as creditRevisions,
} from "../database/schema/catalog-software-participation";
import {
	CatalogSourceOwnedBaselines,
	softwareSourceContextBaseline,
	softwareSourceParticipationBaseline,
} from "../database/schema/catalog-source-owned-baseline";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import type { CatalogSourceNativeChange } from "./source-applications";
import { catalogNameRevisionValues } from "./source-owned-compensation";
import { requireCatalogNameRevision, reviseCatalogName } from "./names";
import { reviseSoftwareParticipation } from "./software-participation";
import { reviseSoftwareParticipationContext } from "./software-contexts";
import { transitionCatalogSemanticState } from "./semantic-history";
import { SoftwareSourceValueSchema } from "./software-source-values";
import { addCatalogNameAuthority } from "./authority";

type Context = Parameters<CatalogSourceNativeWriter>[1];
const maximum = 128;
function admitted<T>(rows: T[]) {
	if (rows.length > maximum)
		throw new RangeError("Source epoch replacement requires staged application");
	return rows;
}

/** @internal Reads persisted prior interpretation only. A rebind to another native target never authorizes its mutation. */
export async function retirePreviousSoftwareSourceEpoch(tx: DatabaseTransaction, context: Context) {
	if (context.action !== "apply" || context.reference.owner !== "software") return null;
	const [claim] = await tx
		.select()
		.from(claims)
		.where(
			and(
				eq(claims.sourceRecordId, context.sourceRecordId),
				eq(claims.mappingKey, context.mappingKey),
			),
		)
		.limit(1);
	if (!claim || claim.correspondenceRevision !== context.correspondenceRevision)
		throw new Error("Source refresh correspondence fence changed");
	if (
		claim.appliedCorrespondenceRevision === null ||
		claim.appliedCorrespondenceRevision === claim.correspondenceRevision ||
		claim.observedSnapshotId === null
	)
		return null;
	const [oldBinding] = await tx
		.select()
		.from(bindingRevisions)
		.where(
			and(
				eq(bindingRevisions.sourceRecordId, context.sourceRecordId),
				eq(bindingRevisions.mappingKey, context.mappingKey),
				eq(bindingRevisions.revision, claim.appliedCorrespondenceRevision),
			),
		)
		.limit(1);
	if (!oldBinding)
		throw new Error("Previous source interpretation is missing its immutable binding");
	if (
		oldBinding.owner !== context.reference.owner ||
		oldBinding.softwareId !== context.reference.id
	)
		return null;
	if (oldBinding.mappingVersion === context.mappingVersion) return null;
	const surfaces = await tx
		.select({ id: snapshots.id, contract: snapshots.contractSha256 })
		.from(snapshots)
		.where(
			and(
				eq(snapshots.sourceRecordId, context.sourceRecordId),
				inArray(snapshots.id, [claim.observedSnapshotId, context.snapshotId]),
			),
		)
		.limit(2);
	const previousContract = surfaces.find((row) => row.id === claim.observedSnapshotId)?.contract;
	const incomingContract = surfaces.find((row) => row.id === context.snapshotId)?.contract;
	if (!previousContract || !incomingContract || previousContract !== incomingContract)
		throw new TypeError(
			"Source epoch refresh across observation surfaces requires a reviewed combined projection",
		);
	const oldEpoch = claim.appliedCorrespondenceRevision,
		snapshotId = claim.observedSnapshotId,
		ownerId = context.reference.id;
	const names = CatalogNameTables.software,
		facts = CatalogFactTables.software;
	const scope = { mappingKey: context.mappingKey, correspondenceRevision: oldEpoch };
	const nameRows = admitted(
		await tx
			.select()
			.from(names.sourceOccurrence)
			.where(
				and(
					eq(names.sourceOccurrence.sourceRecordId, context.sourceRecordId),
					eq(names.sourceOccurrence.mappingKey, scope.mappingKey),
					eq(names.sourceOccurrence.correspondenceRevision, oldEpoch),
					eq(names.sourceOccurrence.snapshotId, snapshotId),
					eq(names.sourceOccurrence.ownerId, ownerId),
				),
			)
			.limit(maximum + 1),
	);
	const contextRows = admitted(
		await tx
			.select()
			.from(contextOccurrences)
			.where(
				and(
					eq(contextOccurrences.sourceRecordId, context.sourceRecordId),
					eq(contextOccurrences.mappingKey, scope.mappingKey),
					eq(contextOccurrences.correspondenceRevision, oldEpoch),
					eq(contextOccurrences.snapshotId, snapshotId),
					eq(contextOccurrences.contentId, ownerId),
				),
			)
			.limit(maximum + 1),
	);
	const creditRows = admitted(
		await tx
			.select()
			.from(creditOccurrences)
			.where(
				and(
					eq(creditOccurrences.sourceRecordId, context.sourceRecordId),
					eq(creditOccurrences.mappingKey, scope.mappingKey),
					eq(creditOccurrences.correspondenceRevision, oldEpoch),
					eq(creditOccurrences.snapshotId, snapshotId),
					eq(creditOccurrences.contentId, ownerId),
				),
			)
			.limit(maximum + 1),
	);
	const semanticRows = admitted(
		await tx
			.select({
				factSemanticId: facts.fact.semanticId,
				factRevision: facts.fact.expectedHeadVersion,
				relationSemanticId: facts.relation.semanticId,
				relationRevision: facts.relation.expectedHeadVersion,
			})
			.from(facts.support)
			.leftJoin(
				facts.fact,
				and(eq(facts.fact.ownerId, facts.support.ownerId), eq(facts.fact.id, facts.support.factId)),
			)
			.leftJoin(
				facts.relation,
				and(
					eq(facts.relation.ownerId, facts.support.ownerId),
					eq(facts.relation.id, facts.support.relationId),
				),
			)
			.where(
				and(
					eq(facts.support.sourceRecordId, context.sourceRecordId),
					eq(facts.support.sourceMappingKey, scope.mappingKey),
					eq(facts.support.sourceCorrespondenceRevision, oldEpoch),
					eq(facts.support.snapshotId, snapshotId),
					eq(facts.support.ownerId, ownerId),
					or(isNotNull(facts.support.factId), isNotNull(facts.support.relationId)),
				),
			)
			.limit(maximum + 1),
	);
	const semantic = new Map<string, { sourceRevision: number; kind: "fact" | "relation" }>();
	for (const row of semanticRows) {
		if (row.factSemanticId && row.factRevision !== null)
			semantic.set(row.factSemanticId, { sourceRevision: row.factRevision + 1, kind: "fact" });
		if (row.relationSemanticId && row.relationRevision !== null)
			semantic.set(row.relationSemanticId, {
				sourceRevision: row.relationRevision + 1,
				kind: "relation",
			});
	}
	const uniqueNames = new Map(nameRows.map((row) => [row.nameId, row]));
	const uniqueContexts = new Map(contextRows.map((row) => [row.contextId, row]));
	const uniqueCredits = new Map(creditRows.map((row) => [row.participationId, row]));
	if (uniqueNames.size + uniqueContexts.size + uniqueCredits.size + semantic.size > maximum)
		throw new RangeError("Source epoch replacement requires staged application");
	const baseline = CatalogSourceOwnedBaselines.software;
	const owned = await tx
		.select()
		.from(baseline)
		.where(
			and(
				eq(baseline.sourceRecordId, context.sourceRecordId),
				eq(baseline.mappingKey, scope.mappingKey),
				eq(baseline.correspondenceRevision, oldEpoch),
				eq(baseline.ownerId, ownerId),
				inArray(baseline.componentKey, [...uniqueNames.keys(), ...semantic.keys()]),
			),
		)
		.limit(maximum);
	const ownedByKey = new Map(owned.map((row) => [`${row.kind}:${row.componentKey}`, row]));
	const expected = (
		kind: "catalog-name" | "catalog-semantic",
		id: string,
		sourceRevision: number,
	) => {
		const found = ownedByKey.get(`${kind}:${id}`);
		return found?.sourceRevision === sourceRevision ? found.currentRevision : sourceRevision;
	};
	const scalarSource = softwareRecordSourceOccurrence;
	const [scalar] = await tx
		.select({ sourceShape: scalarSource.sourceShape, sourceValue: scalarSource.sourceValue })
		.from(scalarSource)
		.where(
			and(
				eq(scalarSource.sourceRecordId, context.sourceRecordId),
				eq(scalarSource.mappingKey, scope.mappingKey),
				eq(scalarSource.correspondenceRevision, oldEpoch),
				eq(scalarSource.snapshotId, snapshotId),
				eq(scalarSource.ownerId, ownerId),
			),
		)
		.limit(1);
	if (!scalar)
		throw new Error("Source refresh requires exact prior native software scalar evidence");
	const source = SoftwareSourceValueSchema.parse(scalar);
	if (source.sourceShape !== "content")
		throw new TypeError("VN refresh needs a content source interpretation");
	const scalarBefore = source.sourceValue;
	const semanticHeads = new Map(
		(
			await tx
				.select({
					id: facts.semanticHead.semanticId,
					version: facts.semanticHead.version,
					state: facts.semanticRevision.state,
				})
				.from(facts.semanticHead)
				.innerJoin(
					facts.semanticRevision,
					and(
						eq(facts.semanticRevision.ownerId, facts.semanticHead.ownerId),
						eq(facts.semanticRevision.semanticId, facts.semanticHead.semanticId),
						eq(facts.semanticRevision.version, facts.semanticHead.version),
					),
				)
				.where(
					and(
						eq(facts.semanticHead.ownerId, ownerId),
						inArray(facts.semanticHead.semanticId, [...semantic.keys()]),
					),
				)
				.limit(maximum)
		).map((row) => [row.id, row]),
	);
	const creditBaselineTable = softwareSourceParticipationBaseline;
	const creditBaselines = new Map(
		(
			await tx
				.select()
				.from(creditBaselineTable)
				.where(
					and(
						eq(creditBaselineTable.sourceRecordId, context.sourceRecordId),
						eq(creditBaselineTable.mappingKey, scope.mappingKey),
						eq(creditBaselineTable.correspondenceRevision, oldEpoch),
						eq(creditBaselineTable.ownerId, ownerId),
						inArray(creditBaselineTable.componentKey, [...uniqueCredits.keys()]),
					),
				)
				.limit(maximum)
		).map((row) => [row.componentKey, row]),
	);
	const currentCredits = new Map(
		(
			await tx
				.select({ value: creditRevisions })
				.from(creditHeads)
				.innerJoin(
					creditRevisions,
					and(
						eq(creditRevisions.contentId, creditHeads.contentId),
						eq(creditRevisions.participationId, creditHeads.id),
						eq(creditRevisions.revision, creditHeads.currentRevision),
					),
				)
				.where(
					and(
						eq(creditHeads.contentId, ownerId),
						inArray(creditHeads.id, [...uniqueCredits.keys()]),
					),
				)
				.limit(maximum)
		).map((row) => [row.value.participationId, row.value]),
	);
	const contextBaselineTable = softwareSourceContextBaseline;
	const contextBaselines = new Map(
		(
			await tx
				.select()
				.from(contextBaselineTable)
				.where(
					and(
						eq(contextBaselineTable.sourceRecordId, context.sourceRecordId),
						eq(contextBaselineTable.mappingKey, scope.mappingKey),
						eq(contextBaselineTable.correspondenceRevision, oldEpoch),
						eq(contextBaselineTable.ownerId, ownerId),
						inArray(contextBaselineTable.componentKey, [...uniqueContexts.keys()]),
					),
				)
				.limit(maximum)
		).map((row) => [row.componentKey, row]),
	);
	const currentContexts = new Map(
		(
			await tx
				.select({ value: softwareParticipationContextRevision })
				.from(softwareParticipationContext)
				.innerJoin(
					softwareParticipationContextRevision,
					and(
						eq(
							softwareParticipationContextRevision.contentId,
							softwareParticipationContext.contentId,
						),
						eq(softwareParticipationContextRevision.contextId, softwareParticipationContext.id),
						eq(
							softwareParticipationContextRevision.revision,
							softwareParticipationContext.currentRevision,
						),
					),
				)
				.where(
					and(
						eq(softwareParticipationContext.contentId, ownerId),
						inArray(softwareParticipationContext.id, [...uniqueContexts.keys()]),
					),
				)
				.limit(maximum)
		).map((row) => [row.value.contextId, row.value]),
	);
	const currentNames = new Map(
		(
			await tx
				.select()
				.from(names.name)
				.where(
					and(eq(names.name.ownerId, ownerId), inArray(names.name.id, [...uniqueNames.keys()])),
				)
				.limit(maximum)
		).map((row) => [row.id, row]),
	);
	const changes: CatalogSourceNativeChange[] = [];
	let revision = context.expectedRevision;
	for (const [id, observed] of [...semantic].sort(
		(left, right) => Number(left[1].kind === "fact") - Number(right[1].kind === "fact"),
	)) {
		const head = semanticHeads.get(id);
		const wanted = expected("catalog-semantic", id, observed.sourceRevision);
		if (!head) throw new Error("Prior source semantic head is missing");
		if (head.version !== wanted || head.state !== "active") continue;
		const retired = await transitionCatalogSemanticState(
			tx,
			context.reference,
			context.actor,
			revision,
			id,
			wanted,
			"superseded",
		);
		revision = retired.revision;
		changes.push({
			kind: "catalog-semantic",
			owner: "software",
			ownerId,
			componentKey: id,
			beforeRevision: wanted,
			afterRevision: retired.headVersion,
		});
	}
	for (const [id, observed] of uniqueCredits) {
		const base = creditBaselines.get(id);
		const wanted =
			base?.sourceRevision === observed.participationRevision
				? base.currentRevision
				: observed.participationRevision;
		const row = currentCredits.get(id);
		if (!row) throw new Error("Prior source participation head is missing");
		if (row.revision !== wanted || row.state !== "active") continue;
		const retired = await reviseSoftwareParticipation(
			tx,
			context.reference,
			context.actor,
			id,
			wanted,
			{
				entityId: row.entityId,
				name:
					row.nameId && row.nameRevision ? { id: row.nameId, revision: row.nameRevision } : null,
				context:
					row.contextId && row.contextRevision
						? { id: row.contextId, revision: row.contextRevision }
						: null,
				characterId: row.characterId,
				roleRevisionId: row.roleRevisionId,
				note: row.note,
				state: "withdrawn",
			},
		);
		changes.push({
			kind: "software-participation",
			ownerId,
			componentKey: id,
			beforeRevision: wanted,
			afterRevision: retired.revision,
		});
	}
	for (const [id, observed] of uniqueContexts) {
		const base = contextBaselines.get(id);
		const wanted =
			base?.sourceRevision === observed.contextRevision
				? base.currentRevision
				: observed.contextRevision;
		const head = currentContexts.get(id);
		if (!head) throw new Error("Prior source context head is missing");
		if (head.revision !== wanted || head.state !== "active") continue;
		const retired = await reviseSoftwareParticipationContext(
			tx,
			context.reference,
			context.actor,
			id,
			wanted,
			{ label: head.label, languageTag: head.languageTag, state: "withdrawn" },
		);
		changes.push({
			kind: "software-context",
			ownerId,
			componentKey: id,
			beforeRevision: wanted,
			afterRevision: retired.revision,
		});
	}
	for (const [id, observed] of uniqueNames) {
		const head = currentNames.get(id);
		const wanted = expected("catalog-name", id, observed.nameRevision);
		if (!head) throw new Error("Prior source name head is missing");
		if (head.revision !== wanted || head.state !== "active") continue;
		const retired = await reviseCatalogName(tx, context.reference, context.actor, id, wanted, {
			...catalogNameRevisionValues(head),
			state: "withdrawn",
		});
		changes.push({
			kind: "catalog-name",
			owner: "software",
			ownerId,
			componentKey: id,
			beforeRevision: wanted,
			afterRevision: retired.revision,
		});
	}
	return {
		revision,
		changes,
		scalarBefore,
		previousEpoch: oldEpoch,
		previousSnapshotId: snapshotId,
	};
}

/** @internal Restored source-created titles get new claims for their exact restored revision, never copied verification. */
export async function restorePreviousSoftwareNameClaims(
	tx: DatabaseTransaction,
	context: Context,
	input: { previousSnapshotId: string; changes: CatalogSourceNativeChange[] },
) {
	const names = CatalogNameTables.software;
	const retired = input.changes.filter(
		(change) => change.kind === "catalog-name" && change.beforeRevision !== null,
	);
	const changes: CatalogSourceNativeChange[] = [];
	for (const change of retired) {
		if (change.kind !== "catalog-name" || change.beforeRevision === null) continue;
		const original = await requireCatalogNameRevision(
			tx,
			context.reference,
			context.actor,
			change.componentKey,
			change.beforeRevision,
		);
		const [current] = await tx
			.select()
			.from(names.name)
			.where(
				and(eq(names.name.ownerId, context.reference.id), eq(names.name.id, change.componentKey)),
			)
			.limit(1);
		if (!current || current.state !== "active") continue;
		const sourceClaims = admitted(
			await tx
				.select()
				.from(names.authority)
				.where(
					and(
						eq(names.authority.ownerId, context.reference.id),
						eq(names.authority.nameId, change.componentKey),
						eq(names.authority.nameRevision, original.revision),
						eq(names.authority.sourceRecordId, context.sourceRecordId),
						eq(names.authority.snapshotId, input.previousSnapshotId),
						eq(names.authority.reviewState, "source_claim"),
						eq(names.authority.state, "active"),
					),
				)
				.limit(maximum + 1),
		);
		for (const source of sourceClaims) {
			const added = await addCatalogNameAuthority(tx, context.reference, context.actor, {
				nameId: current.id,
				nameRevision: current.revision,
				claim: source.claim,
				reviewState: "source_claim",
				authorizerEntityId: source.authorizerEntityId,
				role: source.role,
				territory: source.territory,
				channel: source.channel,
				context: source.context,
				validFrom: source.validFrom?.toISOString() ?? null,
				validUntil: source.validUntil?.toISOString() ?? null,
				reviewEvidence: null,
				state: "active",
				evidence: {
					sourceRecordId: source.sourceRecordId,
					snapshotId: source.snapshotId,
					sourcePath: source.sourcePath,
				},
			});
			changes.push({
				kind: "catalog-name-authority",
				owner: "software",
				ownerId: context.reference.id,
				componentKey: added.id,
				beforeRevision: null,
				afterRevision: added.revision,
			});
		}
	}
	return changes;
}
