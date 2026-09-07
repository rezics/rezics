import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	catalogSourceApplication,
	CatalogSourceProfileApplicationTables,
	CatalogSourceOwnedApplicationTables,
	softwareSourceContextApplicationChange,
	softwareSourceParticipationApplicationChange,
	musicSourceApplicationChange,
	softwareSourceComponentApplicationChange,
	softwareSourceRecordApplicationChange,
} from "../database/schema/catalog-source-application";
import { catalogSourceAdoptionProposal } from "../database/schema/catalog-source";
import { lockCatalogSourceBinding } from "./source-bindings";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogOwnerValues } from "./contracts";
import { loadCatalogIdentity } from "./storage";
import { advanceMusicSourceComponentBaselines } from "./music-source-baselines";
import { advanceCatalogSourceOwnedBaselines } from "./source-owned-baselines";
import { catalogAccessDecisions } from "../participation/policy";

const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const nativeChangeSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("catalog-profile"),
		owner: z.enum(["entity", "reference"]),
		ownerId: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("music-component"),
		ownerId: z.uuid(),
		component: z.string().min(1).max(96),
		componentKey: z.string().min(1).max(1536),
		beforeRevisionId: z.uuid().nullable(),
		afterRevisionId: z.uuid(),
	}),
	z.strictObject({
		kind: z.literal("software-component"),
		ownerId: z.uuid(),
		component: z.enum([
			"content",
			"platform",
			"medium",
			"language",
			"event",
			"patch_target",
			"animation",
		]),
		componentKey: z.string().min(1).max(96),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("software-record"),
		ownerId: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("catalog-semantic"),
		owner: z.enum(CatalogOwnerValues),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("catalog-name"),
		owner: z.enum(CatalogOwnerValues),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("catalog-name-authority"),
		owner: z.enum(CatalogOwnerValues),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("software-context"),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
	z.strictObject({
		kind: z.literal("software-participation"),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
]);

/** Exact native history references emitted by the owning canonical writer. @internal */
export type CatalogSourceNativeChange = z.infer<typeof nativeChangeSchema>;

/** Request bound; larger owners use separately reviewed source mapping scopes and bounded native commands. @internal */
export const CatalogSourceNativeChangesSchema = z
	.array(nativeChangeSchema)
	.max(128)
	.superRefine((changes, ctx) => {
		const seen = new Set<string>();
		for (const [index, change] of changes.entries()) {
			const key = JSON.stringify([
				change.kind,
				"owner" in change ? change.owner : null,
				change.ownerId,
				"component" in change ? change.component : "record",
				"componentKey" in change ? change.componentKey : "",
			]);
			if (seen.has(key))
				ctx.addIssue({
					code: "custom",
					path: [index],
					message: "A native component occurs twice in one application",
				});
			if (
				"afterRevision" in change &&
				change.beforeRevision !== null &&
				change.beforeRevision >= change.afterRevision
			)
				ctx.addIssue({ code: "custom", path: [index], message: "Native history must advance" });
			seen.add(key);
		}
	});

/** Called in the same transaction as native writes and the proposal decision. @internal */
export async function recordCatalogSourceApplication(
	tx: DatabaseTransaction,
	input: {
		sourceRecordId: string;
		proposalId: string;
		mappingKey: string;
		action: "apply" | "withdraw";
		previousSnapshotId: string | null;
		previousObservedSnapshotId: string | null;
		previousCorrespondenceRevision: number | null;
		previousEvidenceSourceRecordId?: string | null;
		previousEvidenceSnapshotId?: string | null;
		previousEvidencePath?: string | null;
		beforeRevision: number;
		afterRevision: number;
	},
	inputChanges: CatalogSourceNativeChange[],
) {
	const changes = CatalogSourceNativeChangesSchema.parse(inputChanges);
	await tx.insert(catalogSourceApplication).values({ ...input, changeCount: changes.length });
	for (const [position, change] of changes.entries()) {
		const common = {
			sourceRecordId: input.sourceRecordId,
			proposalId: input.proposalId,
			action: input.action,
			position,
			ownerId: change.ownerId,
		};
		switch (change.kind) {
			case "catalog-profile": {
				await tx.insert(CatalogSourceProfileApplicationTables[change.owner]).values({
					...common,
					beforeRevision: change.beforeRevision,
					afterRevision: change.afterRevision,
				});
				break;
			}
			case "catalog-semantic":
			case "catalog-name":
			case "catalog-name-authority": {
				const tables = CatalogSourceOwnedApplicationTables[change.owner];
				const table =
					change.kind === "catalog-semantic"
						? tables.semantic
						: change.kind === "catalog-name"
							? tables.name
							: tables.authority;
				await tx.insert(table).values({
					...common,
					componentKey: change.componentKey,
					beforeRevision: change.beforeRevision,
					afterRevision: change.afterRevision,
				});
				break;
			}
			case "software-context":
			case "software-participation": {
				const table =
					change.kind === "software-context"
						? softwareSourceContextApplicationChange
						: softwareSourceParticipationApplicationChange;
				await tx.insert(table).values({
					...common,
					componentKey: change.componentKey,
					beforeRevision: change.beforeRevision,
					afterRevision: change.afterRevision,
				});
				break;
			}
			case "music-component":
				await tx.insert(musicSourceApplicationChange).values({
					...common,
					component: change.component,
					componentKey: change.componentKey,
					beforeRevisionId: change.beforeRevisionId,
					afterRevisionId: change.afterRevisionId,
				});
				break;
			case "software-component":
				await tx.insert(softwareSourceComponentApplicationChange).values({
					...common,
					component: change.component,
					componentKey: change.componentKey,
					beforeRevision: change.beforeRevision,
					afterRevision: change.afterRevision,
				});
				break;
			case "software-record":
				await tx.insert(softwareSourceRecordApplicationChange).values({
					...common,
					beforeRevision: change.beforeRevision,
					afterRevision: change.afterRevision,
				});
				break;
		}
	}
	await advanceMusicSourceComponentBaselines(tx, input, changes);
	await advanceCatalogSourceOwnedBaselines(tx, input, changes);
}

/** Editors may read exact before/after references; native restore rechecks current component heads. @internal */
export async function readCatalogSourceApplication(
	tx: DatabaseTransaction,
	actor: string,
	input: { sourceRecordId: string; proposalId: string; action: "apply" | "withdraw" },
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			proposalId: z.uuid(),
			action: z.enum(["apply", "withdraw"]),
		})
		.parse(input);
	const proposals = catalogSourceAdoptionProposal;
	const [proposal] = await tx
		.select()
		.from(proposals)
		.where(
			and(eq(proposals.sourceRecordId, value.sourceRecordId), eq(proposals.id, value.proposalId)),
		)
		.limit(1);
	if (!proposal) throw new Error("Source application proposal does not exist");
	const binding = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: proposal.mappingKey,
	});
	await loadCatalogIdentity(tx, binding.reference, actor, true);
	const t = catalogSourceApplication;
	const [application] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, value.sourceRecordId),
				eq(t.proposalId, value.proposalId),
				eq(t.action, value.action),
			),
		)
		.limit(1);
	if (!application) return null;
	const changes: (CatalogSourceNativeChange & { position: number })[] = [];
	for (const owner of ["entity", "reference"] as const) {
		const table = CatalogSourceProfileApplicationTables[owner];
		const rows = await tx
			.select()
			.from(table)
			.where(
				and(
					eq(table.sourceRecordId, value.sourceRecordId),
					eq(table.proposalId, value.proposalId),
					eq(table.action, value.action),
				),
			)
			.orderBy(table.position)
			.limit(128);
		for (const row of rows)
			changes.push({
				kind: "catalog-profile",
				owner,
				ownerId: row.ownerId,
				beforeRevision: row.beforeRevision,
				afterRevision: row.afterRevision,
				position: row.position,
			});
	}
	for (const [kind, table] of [
		["music-component", musicSourceApplicationChange],
		["software-component", softwareSourceComponentApplicationChange],
		["software-record", softwareSourceRecordApplicationChange],
		["software-context", softwareSourceContextApplicationChange],
		["software-participation", softwareSourceParticipationApplicationChange],
	] as const) {
		const rows = await tx
			.select()
			.from(table)
			.where(
				and(
					eq(table.sourceRecordId, value.sourceRecordId),
					eq(table.proposalId, value.proposalId),
					eq(table.action, value.action),
				),
			)
			.orderBy(table.position)
			.limit(128);
		for (const row of rows) {
			const {
				sourceRecordId: _source,
				proposalId: _proposal,
				action: _action,
				position,
				...native
			} = row;
			const change = nativeChangeSchema.parse({ ...native, kind });
			changes.push({ ...change, position });
		}
	}
	for (const owner of CatalogOwnerValues) {
		const tables = CatalogSourceOwnedApplicationTables[owner];
		for (const [kind, table] of [
			["catalog-semantic", tables.semantic],
			["catalog-name", tables.name],
			["catalog-name-authority", tables.authority],
		] as const) {
			const rows = await tx
				.select()
				.from(table)
				.where(
					and(
						eq(table.sourceRecordId, value.sourceRecordId),
						eq(table.proposalId, value.proposalId),
						eq(table.action, value.action),
					),
				)
				.orderBy(table.position)
				.limit(128);
			for (const row of rows) {
				changes.push({
					kind,
					owner,
					ownerId: row.ownerId,
					componentKey: row.componentKey,
					beforeRevision: row.beforeRevision,
					afterRevision: row.afterRevision,
					position: row.position,
				});
			}
		}
	}
	for (const owner of CatalogOwnerValues) {
		const ids = [
			...new Set(
				changes
					.filter(
						(change) =>
							("owner" in change
								? change.owner
								: change.kind === "music-component"
									? "music"
									: "software") === owner,
					)
					.map((change) => change.ownerId),
			),
		];
		if (!ids.length) continue;
		const table = CatalogIdentityTables[owner];
		const candidates = await tx
			.select({ id: table.id, createdByAuthUserId: table.createdByAuthUserId })
			.from(table)
			.where(and(inArray(table.id, ids), isNull(table.deletedAt)));
		const allowed = await catalogAccessDecisions(
			tx,
			candidates.map((candidate) => ({
				reference: { owner, id: candidate.id },
				createdByAuthUserId: candidate.createdByAuthUserId,
			})),
			actor,
			true,
		);
		if (candidates.length !== ids.length || allowed.some((value) => !value))
			throw new Error("Native application includes an inaccessible owner");
	}
	changes.sort((a, b) => a.position - b.position);
	if (
		changes.length !== application.changeCount ||
		changes.some((change, index) => change.position !== index)
	)
		throw new Error("Source application native history is incomplete");
	return { application, changes: changes.map(({ position: _position, ...change }) => change) };
}
