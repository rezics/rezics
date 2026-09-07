import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogStructureHistoryTables } from "../database/schema/catalog-structure-history";
import type { CatalogReference } from "./contracts";
import { CatalogRevisionConflict, loadCatalogIdentity } from "./storage";
import {
	ProgramStructureSchema,
	putProgramOccurrence,
	removeProgramOccurrence,
	updateProgramStructure,
} from "./program";
import {
	PublishingStructureSchema,
	putPublishingCoverage,
	removePublishingCoverage,
	putPublishingInstallment,
	removePublishingInstallment,
	updatePublishingStructure,
} from "./publishing";

const identifier = z.uuid().nullable();
const number = z.number().finite().nullable();
const text = z.string().nullable();
const decimal = z
	.union([
		z
			.string()
			.regex(/^-?\d+(?:\.\d+)?$/u)
			.transform(Number),
		z.number().finite(),
	])
	.pipe(z.number().finite())
	.nullable();
const fields = z.object({ id: z.uuid() });
function date(row: Record<string, unknown>) {
	return {
		year: number.parse(row.date_year),
		month: number.parse(row.date_month),
		day: number.parse(row.date_day),
	};
}

/** Converts checked native PostgreSQL snapshots into the same public native command contract. @internal */
export function programStructureRevisionValue(component: string, row: Record<string, unknown>) {
	fields.parse(row);
	switch (component) {
		case "program_work":
			return ProgramStructureSchema.parse({
				shape: "program",
				fields: {
					typeRevisionId: identifier.parse(row.type_revision_id),
					declaredMainEpisodeCount: number.parse(row.declared_main_episode_count),
					declaredTotalEpisodeCount: number.parse(row.declared_total_episode_count),
				},
			});
		case "program_season":
			return ProgramStructureSchema.parse({
				shape: "season",
				fields: { programId: identifier.parse(row.program_id), number: text.parse(row.number) },
			});
		case "program_version":
			return ProgramStructureSchema.parse({
				shape: "program_version",
				fields: {
					programId: identifier.parse(row.program_id),
					versionTypeRevisionId: identifier.parse(row.version_type_revision_id),
					lengthMilliseconds: number.parse(row.length_milliseconds),
				},
			});
		case "program_episode":
			return ProgramStructureSchema.parse({
				shape: "episode",
				fields: {
					programId: identifier.parse(row.program_id),
					seasonId: identifier.parse(row.season_id),
					typeRevisionId: identifier.parse(row.type_revision_id),
					sortNumber: decimal.parse(row.sort_number),
					episodeNumber: decimal.parse(row.episode_number),
					discNumber: number.parse(row.disc_number),
					durationText: text.parse(row.duration_text),
					lengthMilliseconds: number.parse(row.length_milliseconds),
					date: date(row),
					dateText: text.parse(row.date_text),
				},
			});
		default:
			throw new TypeError("Component is not a native program structure");
	}
}

/** @internal A publication and serialization remain independent of invented Work/text parents. */
export function publishingStructureRevisionValue(component: string, row: Record<string, unknown>) {
	fields.parse(row);
	switch (component) {
		case "publishing_work":
			return PublishingStructureSchema.parse({ shape: "work", fields: {} });
		case "publishing_text_version":
			return PublishingStructureSchema.parse({
				shape: "text_version",
				fields: {
					languageTag: text.parse(row.language_tag),
					methodRevisionId: identifier.parse(row.method_revision_id),
				},
			});
		case "publishing_publication":
			return PublishingStructureSchema.parse({
				shape: "publication",
				fields: {
					pageCount: number.parse(row.page_count),
					paginationText: text.parse(row.pagination_text),
				},
			});
		case "publishing_serialization":
			return PublishingStructureSchema.parse({
				shape: "serialization",
				fields: {
					textVersionId: identifier.parse(row.text_version_id),
					statusRevisionId: identifier.parse(row.status_revision_id),
				},
			});
		default:
			throw new TypeError("Component is not a native publishing structure");
	}
}

function historyTables(reference: CatalogReference) {
	if (reference.owner !== "program" && reference.owner !== "publishing")
		throw new TypeError("Expected program or publishing owner");
	return CatalogStructureHistoryTables[reference.owner];
}

/** Editor-only exact child histories; stale versions can contain formerly private parent references. @alpha */
export async function listStructureComponentHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	component: string,
	componentKey: string,
	input: { afterId?: string; limit?: number } = {},
) {
	await loadCatalogIdentity(tx, reference, actor, true);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	z.string().min(1).max(96).parse(component);
	z.string().min(1).max(512).parse(componentKey);
	const table = historyTables(reference).history;
	let afterSequence: number | undefined;
	if (page.afterId) {
		const [cursor] = await tx
			.select({ sequence: table.componentSequence })
			.from(table)
			.where(
				and(
					eq(table.ownerId, reference.id),
					eq(table.id, page.afterId),
					eq(table.component, component),
					eq(table.componentKey, componentKey),
				),
			)
			.limit(1);
		if (!cursor) throw new TypeError("Structure history cursor belongs to another component");
		afterSequence = cursor.sequence;
	}
	return tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
				afterSequence !== undefined ? gt(table.componentSequence, afterSequence) : undefined,
			),
		)
		.orderBy(table.componentSequence)
		.limit(page.limit);
}

/** @internal Caller holds owner authorization and revision lock; lookup is independent of component lifetime. */
export async function readStructureComponentHead(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	component: string,
	componentKey: string,
) {
	const { history: table, head } = historyTables(reference);
	const [row] = await tx
		.select({
			ownerId: table.ownerId,
			id: table.id,
			component: table.component,
			componentKey: table.componentKey,
			componentSequence: table.componentSequence,
			ownerRevision: table.ownerRevision,
			operation: table.operation,
			value: table.value,
			createdAt: table.createdAt,
		})
		.from(head)
		.innerJoin(table, and(eq(table.ownerId, head.ownerId), eq(table.id, head.historyId)))
		.where(
			and(
				eq(head.ownerId, reference.id),
				eq(head.component, component),
				eq(head.componentKey, componentKey),
			),
		)
		.limit(1);
	return row ?? null;
}

/** Restore one component through its native invariant-enforcing writer, with exact current child CAS. @alpha */
export async function restoreStructureComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: { component: string; componentKey: string; expectedHistoryId: string; historyId: string },
) {
	const value = z
		.strictObject({
			component: z.string().min(1).max(96),
			componentKey: z.string().min(1).max(512),
			expectedHistoryId: z.uuid(),
			historyId: z.uuid(),
		})
		.parse(input);
	const table = historyTables(reference).history;
	return tx.transaction(async (write) => {
		await loadCatalogIdentity(write, reference, actor, true);
		const current = await readStructureComponentHead(
			write,
			reference,
			value.component,
			value.componentKey,
		);
		if (!current || current.id !== value.expectedHistoryId)
			throw new CatalogRevisionConflict("Native structure component changed");
		const [history] = await write
			.select()
			.from(table)
			.where(
				and(
					eq(table.ownerId, reference.id),
					eq(table.id, value.historyId),
					eq(table.component, value.component),
					eq(table.componentKey, value.componentKey),
				),
			)
			.limit(1);
		if (!history) throw new TypeError("History does not belong to this exact native component");
		const row = history.value;
		let result: { revision: number };
		if (reference.owner === "program") {
			if (history.component === "program_episode_occurrence") {
				const occurrence = z
					.object({
						id: z.uuid(),
						owner_id: z.uuid(),
						episode_id: z.uuid(),
						position: z.string(),
						source_number: text,
					})
					.parse(row);
				if (occurrence.owner_id !== reference.id || occurrence.id !== history.componentKey)
					throw new TypeError("Occurrence history identity differs");
				result =
					history.operation === "DELETE"
						? await removeProgramOccurrence(
								write,
								reference,
								actor,
								expectedRevision,
								occurrence.id,
							)
						: await putProgramOccurrence(write, reference, actor, expectedRevision, {
								id: occurrence.id,
								episodeId: occurrence.episode_id,
								position: occurrence.position,
								sourceNumber: occurrence.source_number,
							});
			} else {
				if (history.operation === "DELETE")
					throw new TypeError(
						"A native structural identity cannot be removed by component restore",
					);
				result = await updateProgramStructure(
					write,
					reference,
					actor,
					expectedRevision,
					programStructureRevisionValue(history.component, row),
				);
			}
		} else if (history.component === "publishing_installment") {
			const installment = z
				.object({
					id: z.uuid(),
					serialization_id: z.uuid(),
					parent_id: identifier,
					position: z.string(),
					label: text,
					kind_revision_id: z.uuid(),
					date_text: text,
				})
				.parse(row);
			if (installment.serialization_id !== reference.id || installment.id !== history.componentKey)
				throw new TypeError("Installment history identity differs");
			result =
				history.operation === "DELETE"
					? await removePublishingInstallment(
							write,
							reference,
							actor,
							expectedRevision,
							installment.id,
						)
					: await putPublishingInstallment(write, reference, actor, expectedRevision, {
							id: installment.id,
							parentId: installment.parent_id,
							position: installment.position,
							label: installment.label,
							kindRevisionId: installment.kind_revision_id,
							date: date(row),
							dateText: installment.date_text,
						});
		} else if (
			[
				"publishing_text_work",
				"publishing_publication_text",
				"publishing_publication_work",
			].includes(history.component)
		) {
			const kind =
				history.component === "publishing_text_work"
					? "text_work"
					: history.component === "publishing_publication_text"
						? "publication_text"
						: "publication_work";
			const targetId = z
				.uuid()
				.parse(kind === "publication_text" ? row.text_version_id : row.work_id);
			if (targetId !== history.componentKey)
				throw new TypeError("Coverage history identity differs");
			result =
				history.operation === "DELETE"
					? await removePublishingCoverage(
							write,
							reference,
							actor,
							expectedRevision,
							kind,
							targetId,
						)
					: await putPublishingCoverage(write, reference, actor, expectedRevision, {
							kind,
							targetId,
							position: z.number().int().nonnegative().parse(row.position),
							coverageText: text.parse(row.coverage_text),
						});
		} else {
			if (history.operation === "DELETE")
				throw new TypeError("A native structural identity cannot be removed by component restore");
			result = await updatePublishingStructure(
				write,
				reference,
				actor,
				expectedRevision,
				publishingStructureRevisionValue(history.component, row),
			);
		}
		const after = await readStructureComponentHead(
			write,
			reference,
			value.component,
			value.componentKey,
		);
		if (!after || after.id === current.id)
			throw new Error("Native restoration did not record a new component revision");
		return { ...result, beforeHistoryId: current.id, afterHistoryId: after.id };
	});
}
