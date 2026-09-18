import { readAuthorizedChildNameLabels } from "./child-name-labels";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogStructureHistoryTables } from "@rezics/schema/postgres/history/structure-history";
import { programIdentity } from "@rezics/schema/postgres/catalog/identity";
import {
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	canAccessCatalog,
} from "../participation/policy";
import { loadCatalogIdentity, CatalogRevisionConflict, CatalogReferenceNotFound } from "./storage";
import {
	readProgramStructure,
	updateProgramStructure,
	putProgramOccurrence,
	removeProgramOccurrence,
	listProgramOccurrences,
} from "./program";
import {
	readStructureComponentHead,
	programStructureRevisionValue,
	restoreStructureComponent,
} from "./structure-history";
import {
	ProgramDetailsSchema,
	ProgramMutationSchema,
	ProgramEditSchema,
	ProgramOccurrencePutSchema,
	ProgramOccurrenceRemoveSchema,
	ProgramOccurrenceSchema,
	ProgramPageQuerySchema,
	ProgramHistorySchema,
	ProgramComponentSchema,
	ProgramRestoreSchema,
} from "./program-api-contracts";
import {
	decodeDomainCursor,
	domainPage,
	encodeDomainCursor,
	lockDomainSnapshot,
} from "./domain-api-pagination";
const reference = (id: string) => ({ owner: "program" as const, id: z.uuid().parse(id) });
const components = {
	program: "program_work",
	season: "program_season",
	program_version: "program_version",
	episode: "program_episode",
} as const;
const snake = (input: unknown) =>
	Object.fromEntries(
		Object.entries(z.record(z.string(), z.unknown()).parse(input)).map(([key, value]) => [
			key.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
			value,
		]),
	);
/** @internal Explicit DTO projection keeps immutable native values and private Auth attribution separate. */
export async function readProgramApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
) {
	await lockDomainSnapshot(tx, reference(id));
	const result = await readProgramStructure(tx, reference(id), actor),
		shape = z
			.enum(["program", "season", "program_version", "episode"])
			.parse(result.identity.shape),
		component = components[shape];
	const head = await readStructureComponentHead(tx, reference(id), component, id);
	if (!head) throw new CatalogReferenceNotFound("Program component history is missing");
	return ProgramDetailsSchema.parse({
		canEdit: await canAccessCatalog(
			tx,
			reference(id),
			actor,
			result.identity.createdByAuthUserId,
			true,
		),
		id,
		revision: result.identity.revision,
		historyId: head.id,
		componentSequence: head.componentSequence,
		structure: programStructureRevisionValue(component, snake(result.record)),
	});
}
async function fence(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: string,
	key: string,
	expected: string | null,
) {
	await loadCatalogIdentity(tx, reference(id), actor, true);
	const current = await readStructureComponentHead(tx, reference(id), component, key);
	if ((current?.id ?? null) !== expected)
		throw new CatalogRevisionConflict("Program child history changed");
	return current;
}
async function mutation(
	tx: DatabaseTransaction,
	id: string,
	component: string,
	key: string,
	revision: number,
) {
	const head = await readStructureComponentHead(tx, reference(id), component, key);
	if (!head) throw new Error("Program mutation did not publish component history");
	return ProgramMutationSchema.parse({
		revision,
		historyId: head.id,
		componentSequence: head.componentSequence,
	});
}
export async function editProgramApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.output<typeof ProgramEditSchema>,
) {
	const body = ProgramEditSchema.parse(input),
		component = components[body.structure.shape];
	await fence(tx, id, actor, component, id, body.expectedHistoryId);
	const result = await updateProgramStructure(
		tx,
		reference(id),
		actor,
		body.expectedRevision,
		body.structure,
	);
	return mutation(tx, id, component, id, result.revision);
}
export async function putProgramApiOccurrence(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	occurrenceId: string,
	body: z.output<typeof ProgramOccurrencePutSchema>,
) {
	await fence(tx, id, actor, "program_episode_occurrence", occurrenceId, body.expectedHistoryId);
	const result = await putProgramOccurrence(tx, reference(id), actor, body.expectedRevision, {
		id: occurrenceId,
		...body.value,
	});
	return mutation(tx, id, "program_episode_occurrence", occurrenceId, result.revision);
}
export async function removeProgramApiOccurrence(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	occurrenceId: string,
	body: z.output<typeof ProgramOccurrenceRemoveSchema>,
) {
	const head = await fence(
		tx,
		id,
		actor,
		"program_episode_occurrence",
		occurrenceId,
		body.expectedHistoryId,
	);
	if (head?.operation === "DELETE")
		throw new CatalogRevisionConflict("Program occurrence is already absent");
	const result = await removeProgramOccurrence(
		tx,
		reference(id),
		actor,
		body.expectedRevision,
		occurrenceId,
	);
	return mutation(tx, id, "program_episode_occurrence", occurrenceId, result.revision);
}
export async function pageProgramApiOccurrences(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.output<typeof ProgramPageQuerySchema>,
) {
	await lockDomainSnapshot(tx, reference(id));
	const scope = `program/${id}/occurrences`,
		cursor = decodeDomainCursor(
			scope,
			input.cursor,
			z.strictObject({ position: z.string().max(512), id: z.uuid() }),
		);
	const after =
		cursor === undefined
			? undefined
			: z.strictObject({ position: z.string().max(512), id: z.uuid() }).parse(cursor);
	const native = await listProgramOccurrences(tx, reference(id), actor, {
		limit: input.limit,
		after,
	});
	const heads = CatalogStructureHistoryTables.program.head;
	const result = native.items.length
		? await tx.execute(
				sql`select selected.id, h.history_id, h.component_sequence from unnest(${sql.param(native.items.map((item) => item.id))}::text[]) selected(id) join ${heads} h on h.owner_id=${id}::uuid and h.component='program_episode_occurrence' and h.component_key=selected.id`,
			)
		: { rows: [] };
	const histories = new Map(
		z
			.array(
				z.object({
					id: z.uuid(),
					history_id: z.uuid(),
					component_sequence: z.coerce.number().int().positive().safe(),
				}),
			)
			.parse(result.rows)
			.map((row) => [row.id, row]),
	);
	const labels = await readAuthorizedChildNameLabels(
		tx,
		"program",
		native.items.map((row) => row.episodeId),
	);
	const items = native.items.map((row) =>
		ProgramOccurrenceSchema.parse({
			name: labels.get(row.episodeId) ?? null,
			id: row.id,
			historyId: histories.get(row.id)?.history_id,
			componentSequence: histories.get(row.id)?.component_sequence,
			value: { episodeId: row.episodeId, position: row.position, sourceNumber: row.sourceNumber },
		}),
	);
	const page = domainPage(
		scope,
		items,
		input.limit,
		(row) => ({ position: row.value.position, id: row.id }),
		native.nextCursor !== null,
	);
	if (page.items.length === items.length && native.nextCursor)
		page.nextCursor = encodeDomainCursor(scope, native.nextCursor);
	return page;
}
async function historyVisibility(
	tx: DatabaseTransaction,
	actor: string,
	component: z.output<typeof ProgramComponentSchema>,
) {
	const scope = await readCatalogAuthorityScope(tx, actor),
		table = CatalogStructureHistoryTables.program.history;
	const keys =
		component === "program_episode_occurrence"
			? ["episode_id"]
			: component === "program_episode"
				? ["program_id", "season_id"]
				: component === "program_season" || component === "program_version"
					? ["program_id"]
					: [];
	return and(
		...keys.map(
			(key) =>
				sql`(${table.value}->>${key} is null or exists(select 1 from ${programIdentity} where ${programIdentity.id}=(${table.value}->>${key})::uuid and ${catalogIdentityReadPredicate(scope, "program", programIdentity)}))`,
		),
	);
}
export async function pageProgramApiHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: z.output<typeof ProgramComponentSchema>,
	componentKey: string,
	input: z.output<typeof ProgramPageQuerySchema>,
) {
	await loadCatalogIdentity(tx, reference(id), actor, true);
	const table = CatalogStructureHistoryTables.program.history,
		scope = `program/${id}/history/${component}/${componentKey}`,
		cursor = decodeDomainCursor(scope, input.cursor, z.uuid());
	let sequence: number | undefined;
	if (cursor !== undefined) {
		const [row] = await tx
			.select({ sequence: table.componentSequence })
			.from(table)
			.where(
				and(
					eq(table.ownerId, id),
					eq(table.component, component),
					eq(table.componentKey, componentKey),
					eq(table.id, z.uuid().parse(cursor)),
				),
			)
			.limit(1);
		if (!row) throw new TypeError("Program cursor belongs to another component");
		sequence = row.sequence;
	}
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, id),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
				sequence === undefined ? undefined : gt(table.componentSequence, sequence),
				await historyVisibility(tx, actor, component),
			),
		)
		.orderBy(table.componentSequence)
		.limit(input.limit);
	const items = rows.map((row) =>
		ProgramHistorySchema.parse({
			id: row.id,
			component: row.component,
			componentKey: row.componentKey,
			componentSequence: row.componentSequence,
			operation: row.operation,
			recordedAt: row.createdAt.toISOString(),
			snapshot:
				component === "program_episode_occurrence"
					? {
							kind: "occurrence",
							value: {
								episodeId: row.value.episode_id,
								position: row.value.position,
								sourceNumber: row.value.source_number,
							},
						}
					: { kind: "structure", value: programStructureRevisionValue(component, row.value) },
		}),
	);
	return domainPage(scope, items, input.limit, (row) => row.id);
}
export async function restoreProgramApiHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: z.output<typeof ProgramComponentSchema>,
	componentKey: string,
	body: z.output<typeof ProgramRestoreSchema>,
) {
	await loadCatalogIdentity(tx, reference(id), actor, true);
	const table = CatalogStructureHistoryTables.program.history;
	const [visible] = await tx
		.select({ id: table.id })
		.from(table)
		.where(
			and(
				eq(table.ownerId, id),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
				eq(table.id, body.historyId),
				await historyVisibility(tx, actor, component),
			),
		)
		.limit(1);
	if (!visible) throw new CatalogReferenceNotFound("Program history is unavailable");
	const result = await restoreStructureComponent(tx, reference(id), actor, body.expectedRevision, {
		component,
		componentKey,
		expectedHistoryId: body.expectedHistoryId,
		historyId: body.historyId,
	});
	return mutation(tx, id, component, componentKey, result.revision);
}
