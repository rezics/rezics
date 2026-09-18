import { MUSIC_SOURCE_COMPONENT_LIMIT, MUSIC_SOURCE_APPLICATION_LIMIT, SOURCE_ANCILLARY_CHANGE_LIMIT } from "@rezics/schema/postgres/ingestion/source-limits";
import { CatalogChildSourceChangeSchema } from "./child-source-contracts";
import { CatalogChildSourceTables } from "@rezics/schema/postgres/ingestion/child-source";
import { advanceChildSourceBaselines } from "./child-source-baselines";
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
} from "@rezics/schema/postgres/ingestion/source-application";
import { catalogSourceAdoptionProposal } from "@rezics/schema/postgres/ingestion/source";
import { lockCatalogSourceBinding } from "./source-bindings";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { CatalogOwnerValues } from "@rezics/schema/contracts/native/catalog";
import { loadCatalogIdentity } from "./storage";
import { advanceMusicSourceComponentBaselines } from "./music-source-baselines";
import { advanceCatalogSourceOwnedBaselines } from "./source-owned-baselines";
import { catalogAccessDecisions } from "../participation/policy";
import { CatalogStructureSourceChangeSchema } from "./structure-source-contracts";
import { CatalogStructureSourceTables } from "@rezics/schema/postgres/ingestion/structure-source";
import { advanceStructureSourceBaselines } from "./structure-source";

const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const nativeChangeSchema = z.discriminatedUnion("kind", [
	CatalogChildSourceChangeSchema,
	CatalogStructureSourceChangeSchema,
	z.strictObject({
		kind: z.literal("catalog-identifier"),
		owner: z.enum(CatalogOwnerValues),
		ownerId: z.uuid(),
		componentKey: z.uuid(),
		beforeRevision: revision.nullable(),
		afterRevision: revision,
	}),
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
	.max(MUSIC_SOURCE_APPLICATION_LIMIT)
	.superRefine((changes, ctx) => {
		const music = changes.filter((change) => change.kind === "music-component");
		if (music.length > MUSIC_SOURCE_COMPONENT_LIMIT || changes.length - music.length > SOURCE_ANCILLARY_CHANGE_LIMIT ||
			(changes.length > 128 && (new Set(changes.map((change) => change.ownerId)).size !== 1 || changes.some((change) => change.kind !== "music-component" && (!("owner" in change) || change.owner !== "music" || !["catalog-name", "catalog-name-authority", "catalog-identifier", "catalog-semantic"].includes(change.kind))))))
			ctx.addIssue({ code: "custom", message: "Source application exceeds its owner-local publication budget" });
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
	const musicRows = changes.flatMap((change, position) => change.kind === "music-component" ? [{
		sourceRecordId: input.sourceRecordId, proposalId: input.proposalId, action: input.action, position,
		ownerId: change.ownerId, component: change.component, componentKey: change.componentKey,
		beforeRevisionId: change.beforeRevisionId, afterRevisionId: change.afterRevisionId,
	}] : []);
	for (let offset = 0; offset < musicRows.length; offset += 128)
		await tx.insert(musicSourceApplicationChange).values(musicRows.slice(offset, offset + 128));
	for (const [position, change] of changes.entries()) {
		const common = {
			sourceRecordId: input.sourceRecordId,
			proposalId: input.proposalId,
			action: input.action,
			position,
			ownerId: change.ownerId,
		};
		switch (change.kind) {
			case "catalog-child": {
				await tx.insert(CatalogChildSourceTables[change.owner].application).values({
					...common,
					component: change.component,
					componentKey: change.componentKey,
					beforeRevisionId: change.beforeRevisionId,
					afterRevisionId: change.afterRevisionId,
				});
				break;
			}
			case "catalog-structure": {
				await tx.insert(CatalogStructureSourceTables[change.owner].application).values({
					...common,
					component: change.component,
					componentKey: change.componentKey,
					beforeRevisionId: change.beforeRevisionId,
					afterRevisionId: change.afterRevisionId,
				});
				break;
			}
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
			case "catalog-identifier":
			case "catalog-name-authority": {
				const tables = CatalogSourceOwnedApplicationTables[change.owner];
				const table =
					change.kind === "catalog-semantic"
						? tables.semantic
						: change.kind === "catalog-name"
							? tables.name
							: change.kind === "catalog-identifier"
								? tables.identifier
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
	await advanceChildSourceBaselines(
		tx,
		input,
		changes.filter((change) => change.kind === "catalog-child"),
	);
	await advanceStructureSourceBaselines(
		tx,
		input,
		changes.filter((change) => change.kind === "catalog-structure"),
	);
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
	for (const owner of ["program", "publishing"] as const) {
		const table = CatalogChildSourceTables[owner].application;
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
				...CatalogChildSourceChangeSchema.parse({
					kind: "catalog-child",
					owner,
					ownerId: row.ownerId,
					component: row.component,
					componentKey: row.componentKey,
					beforeRevisionId: row.beforeRevisionId,
					afterRevisionId: row.afterRevisionId,
				}),
				position: row.position,
			});
	}
	for (const owner of ["program", "publishing"] as const) {
		const table = CatalogStructureSourceTables[owner].application;
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
				...CatalogStructureSourceChangeSchema.parse({
					kind: "catalog-structure",
					owner,
					ownerId: row.ownerId,
					component: row.component,
					componentKey: row.componentKey,
					beforeRevisionId: row.beforeRevisionId,
					afterRevisionId: row.afterRevisionId,
				}),
				position: row.position,
			});
	}
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
			.limit(kind === "music-component" ? MUSIC_SOURCE_COMPONENT_LIMIT + 1 : 128);
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
			["catalog-identifier", tables.identifier],
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
					...nativeChangeSchema.parse({
						kind,
						owner,
						ownerId: row.ownerId,
						componentKey: row.componentKey,
						beforeRevision: row.beforeRevision,
						afterRevision: row.afterRevision,
					}),
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
	return { application, changes: CatalogSourceNativeChangesSchema.parse(changes.map(({ position: _position, ...change }) => change)) };
}
