import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogStructureHistoryTables } from "../database/schema/catalog-structure-history";
import {
	publishingTextWork,
	publishingPublicationText,
	publishingPublicationWork,
	publishingPublicationFacet,
	publishingReleaseEvent,
	publishingInstallment,
	publishingSerialization,
} from "../database/schema/catalog-publishing";
import {
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	canAccessCatalog,
} from "../participation/policy";
import { loadCatalogIdentity, CatalogRevisionConflict, CatalogReferenceNotFound } from "./storage";
import { readPublishingStructure, updatePublishingStructure } from "./publishing";
import {
	putPublishingComponent,
	removePublishingComponent,
	publishingComponentRevisionValue,
	PublishingComponentKinds,
	type PublishingComponentValue,
} from "./publishing-components";
import {
	publishingStructureRevisionValue,
	readStructureComponentHead,
	restoreStructureComponent,
} from "./structure-history";
import {
	PublishingDetailsSchema,
	PublishingEditSchema,
	PublishingMutationSchema,
	PublishingChildSchema,
	PublishingChildPutSchema,
	PublishingChildRemoveSchema,
	PublishingPageQuerySchema,
	PublishingChildrenQuerySchema,
	PublishingHistoryComponentSchema,
	PublishingHistorySchema,
	PublishingRestoreSchema,
	PublishingConnectionsQuerySchema,
	PublishingConnectionSchema,
} from "./publishing-api-contracts";
import {
	decodeDomainCursor,
	domainPage,
	encodeDomainCursor,
	lockDomainSnapshot,
} from "./domain-api-pagination";
import { readAuthorizedChildNameLabels } from "./child-name-labels";
const reference = (id: string) => ({ owner: "publishing" as const, id: z.uuid().parse(id) });
const roots = {
	work: "publishing_work",
	text_version: "publishing_text_version",
	publication: "publishing_publication",
	serialization: "publishing_serialization",
} as const;
const rootComponents = new Set<string>(Object.values(roots));
const snake = (value: unknown) =>
	Object.fromEntries(
		Object.entries(z.record(z.string(), z.unknown()).parse(value)).map(([key, value]) => [
			key.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
			value,
		]),
	);

/** @internal Public native Publishing DTOs omit private Auth and source control attributes. */
export async function readPublishingApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
) {
	await lockDomainSnapshot(tx, reference(id));
	const { identity, record } = await readPublishingStructure(tx, reference(id), actor);
	const shape = z
		.enum(["work", "text_version", "publication", "serialization"])
		.parse(identity.shape);
	const head = await readStructureComponentHead(tx, reference(id), roots[shape], id);
	if (!head) throw new CatalogReferenceNotFound("Publishing component history is missing");
	return PublishingDetailsSchema.parse({
		id,
		revision: identity.revision,
		historyId: head.id,
		componentSequence: head.componentSequence,
		canEdit: await canAccessCatalog(tx, reference(id), actor, identity.createdByAuthUserId, true),
		structure: publishingStructureRevisionValue(roots[shape], snake(record)),
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
	const head = await readStructureComponentHead(tx, reference(id), component, key);
	if ((head?.id ?? null) !== expected)
		throw new CatalogRevisionConflict("Publishing component history changed");
	return head;
}
async function mutation(
	tx: DatabaseTransaction,
	id: string,
	component: string,
	key: string,
	revision: number,
) {
	const head = await readStructureComponentHead(tx, reference(id), component, key);
	if (!head) throw new Error("Publishing mutation did not publish its exact child history");
	return PublishingMutationSchema.parse({
		revision,
		historyId: head.id,
		componentSequence: head.componentSequence,
	});
}
export async function editPublishingApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.output<typeof PublishingEditSchema>,
) {
	const body = PublishingEditSchema.parse(input),
		component = roots[body.structure.shape];
	await fence(tx, id, actor, component, id, body.expectedHistoryId);
	const result = await updatePublishingStructure(
		tx,
		reference(id),
		actor,
		body.expectedRevision,
		body.structure,
	);
	return mutation(tx, id, component, id, result.revision);
}
export async function putPublishingApiChild(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	kind: PublishingComponentValue["kind"],
	key: string,
	body: z.output<typeof PublishingChildPutSchema>,
) {
	if (body.value.kind !== kind)
		throw new TypeError("Publishing component kind differs from its route");
	const component = PublishingComponentKinds[kind];
	await fence(tx, id, actor, component, key, body.expectedHistoryId);
	const result = await putPublishingComponent(
		tx,
		reference(id),
		actor,
		body.expectedRevision,
		key,
		body.value,
	);
	return mutation(tx, id, component, key, result.revision);
}
export async function removePublishingApiChild(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	kind: PublishingComponentValue["kind"],
	key: string,
	body: z.output<typeof PublishingChildRemoveSchema>,
) {
	const component = PublishingComponentKinds[kind];
	const head = await fence(tx, id, actor, component, key, body.expectedHistoryId);
	if (!head || head.operation === "DELETE")
		throw new CatalogReferenceNotFound("Publishing component is absent");
	const result = await removePublishingComponent(
		tx,
		reference(id),
		actor,
		body.expectedRevision,
		kind,
		key,
	);
	return mutation(tx, id, component, key, result.revision);
}
const childTables = {
	text_work: {
		table: publishingTextWork,
		owner: publishingTextWork.textVersionId,
		key: publishingTextWork.workId,
		position: publishingTextWork.position,
		shape: "text_version",
		target: publishingTextWork.workId,
		targetOwner: "publishing",
	},
	publication_text: {
		table: publishingPublicationText,
		owner: publishingPublicationText.publicationId,
		key: publishingPublicationText.textVersionId,
		position: publishingPublicationText.position,
		shape: "publication",
		target: publishingPublicationText.textVersionId,
		targetOwner: "publishing",
	},
	publication_work: {
		table: publishingPublicationWork,
		owner: publishingPublicationWork.publicationId,
		key: publishingPublicationWork.workId,
		position: publishingPublicationWork.position,
		shape: "publication",
		target: publishingPublicationWork.workId,
		targetOwner: "publishing",
	},
	facet: {
		table: publishingPublicationFacet,
		owner: publishingPublicationFacet.publicationId,
		key: publishingPublicationFacet.definitionRevisionId,
		position: null,
		shape: "publication",
		target: null,
		targetOwner: "publishing",
	},
	event: {
		table: publishingReleaseEvent,
		owner: publishingReleaseEvent.publicationId,
		key: publishingReleaseEvent.id,
		position: null,
		shape: "publication",
		target: publishingReleaseEvent.publisherEntityId,
		targetOwner: "entity",
	},
	installment: {
		table: publishingInstallment,
		owner: publishingInstallment.serializationId,
		key: publishingInstallment.id,
		position: publishingInstallment.position,
		shape: "serialization",
		target: null,
		targetOwner: "publishing",
	},
} as const;
const rowPageSchema = z.array(
	z.object({
		key: z.uuid(),
		position: z.union([z.string(), z.number()]).nullable(),
		value: z.record(z.string(), z.unknown()),
		readable: z.boolean(),
	}),
);
const childCursor = z.strictObject({
	id: z.uuid(),
	position: z.union([z.string(), z.number()]).nullable(),
});
async function visibleReference(
	tx: DatabaseTransaction,
	actor: string | null,
	owner: "publishing" | "entity" | "reference",
	column: AnyPgColumn | SQL,
) {
	const scope = await readCatalogAuthorityScope(tx, actor),
		target = CatalogIdentityTables[owner];
	return sql`(${column} is null or exists(select 1 from ${target} where ${target.id}=${column} and ${catalogIdentityReadPredicate(scope, owner, target)}))`;
}
/** @internal Read a bounded physical page before filtering hidden references; the cursor advances over hidden rows. */
export async function pagePublishingApiChildren(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	kind: PublishingComponentValue["kind"],
	input: z.output<typeof PublishingChildrenQuerySchema>,
) {
	await lockDomainSnapshot(tx, reference(id));
	const identity = await loadCatalogIdentity(tx, reference(id), actor, false),
		selected = childTables[kind];
	if (identity.shape !== selected.shape)
		throw new TypeError("Publishing component owner has another native shape");
	if (kind !== "installment" && input.parentId !== undefined)
		throw new TypeError("Only installment pages have a parent scope");
	const scope = `publishing/${id}/${kind}/${input.parentId ?? "root"}`,
		after = decodeDomainCursor(scope, input.cursor, childCursor);
	if (after && (selected.position === null) !== (after.position === null))
		throw new TypeError("Publishing cursor order differs");
	const visibility = selected.target
		? await visibleReference(tx, actor, selected.targetOwner, selected.target)
		: sql`true`;
	const areaVisibility =
		kind === "event"
			? await visibleReference(tx, actor, "reference", publishingReleaseEvent.areaId)
			: sql`true`;
	const parent =
		kind === "installment"
			? input.parentId
				? sql`${publishingInstallment.parentId}=${input.parentId}::uuid`
				: sql`${publishingInstallment.parentId} is null`
			: sql`true`;
	const afterPredicate = !after
		? sql`true`
		: selected.position
			? sql`(${selected.position}>${after.position} or (${selected.position}=${after.position} and ${selected.key}>${after.id}::uuid))`
			: sql`${selected.key}>${after.id}::uuid`;
	const result = await tx.execute(
		sql`select ${selected.key} as key, ${selected.position ?? sql`null`} as position, to_jsonb(${selected.table}) as value, (${visibility} and ${areaVisibility}) as readable from ${selected.table} where ${selected.owner}=${id}::uuid and ${parent} and ${afterPredicate} order by ${selected.position ? sql`${selected.position},` : sql``}${selected.key} limit ${input.limit}`,
	);
	const raw = rowPageSchema.parse(result.rows),
		visible = raw.filter((row) => row.readable),
		component = PublishingComponentKinds[kind];
	const heads = CatalogStructureHistoryTables.publishing.head;
	const rows = visible.length
		? await tx.execute(
				sql`select h.component_key as key,h.history_id,h.component_sequence from ${heads} h where h.owner_id=${id}::uuid and h.component=${component} and h.component_key=any(${sql.param(visible.map((row) => row.key))}::text[])`,
			)
		: { rows: [] };
	const historyByKey = new Map(
		z
			.array(
				z.object({
					key: z.uuid(),
					history_id: z.uuid(),
					component_sequence: z.coerce.number().int().positive().safe(),
				}),
			)
			.parse(rows.rows)
			.map((row) => [row.key, row]),
	);
	const targetIds = visible.flatMap((row) => {
		const value = publishingComponentRevisionValue(component, row.value);
		return "targetId" in value
			? [value.targetId]
			: value.kind === "event" && value.publisherEntityId
				? [value.publisherEntityId]
				: [];
	});
	const labels = await readAuthorizedChildNameLabels(tx, selected.targetOwner, targetIds);
	const items = visible.map((row) => {
		const value = publishingComponentRevisionValue(component, row.value),
			head = historyByKey.get(row.key),
			labelKey =
				"targetId" in value
					? value.targetId
					: value.kind === "event"
						? value.publisherEntityId
						: null;
		return PublishingChildSchema.parse({
			id: row.key,
			historyId: head?.history_id,
			componentSequence: head?.component_sequence,
			value,
			name: labelKey ? (labels.get(labelKey) ?? null) : null,
		});
	});
	const cursorFor = (item: z.output<typeof PublishingChildSchema>) => ({
		id: item.id,
		position: "position" in item.value ? item.value.position : null,
	});
	const page = domainPage(scope, items, input.limit, cursorFor, raw.length === input.limit);
	if (page.items.length === items.length && raw.length === input.limit) {
		const last = raw.at(-1);
		if (last)
			page.nextCursor = encodeDomainCursor(scope, { id: last.key, position: last.position });
	}
	return page;
}
async function historyVisibility(
	tx: DatabaseTransaction,
	actor: string,
	component: z.output<typeof PublishingHistoryComponentSchema>,
) {
	const value = CatalogStructureHistoryTables.publishing.history.value;
	const targets: Array<{ key: string; owner: "publishing" | "entity" | "reference" }> =
		component === "publishing_text_work" || component === "publishing_publication_work"
			? [{ key: "work_id", owner: "publishing" }]
			: component === "publishing_publication_text" || component === "publishing_serialization"
				? [{ key: "text_version_id", owner: "publishing" }]
				: component === "publishing_release_event"
					? [
							{ key: "publisher_entity_id", owner: "entity" },
							{ key: "area_id", owner: "reference" },
						]
					: [];
	const predicates = await Promise.all(
		targets.map((target) =>
			visibleReference(tx, actor, target.owner, sql`(${value}->>${target.key})::uuid`),
		),
	);
	return and(...predicates) ?? sql`true`;
}
export async function pagePublishingApiHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: z.output<typeof PublishingHistoryComponentSchema>,
	componentKey: string,
	input: z.output<typeof PublishingPageQuerySchema>,
) {
	await loadCatalogIdentity(tx, reference(id), actor, true);
	const table = CatalogStructureHistoryTables.publishing.history,
		scope = `publishing/${id}/history/${component}/${componentKey}`,
		after = decodeDomainCursor(scope, input.cursor, z.number().int().positive().safe());
	const rows = await tx
		.select({
			row: table,
			readable: sql<boolean>`${await historyVisibility(tx, actor, component)}`,
		})
		.from(table)
		.where(
			and(
				eq(table.ownerId, id),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
				after === undefined ? undefined : gt(table.componentSequence, after),
			),
		)
		.orderBy(table.componentSequence)
		.limit(input.limit);
	const items = rows
		.filter((item) => item.readable)
		.map(({ row }) =>
			PublishingHistorySchema.parse({
				id: row.id,
				component: row.component,
				componentKey: row.componentKey,
				componentSequence: row.componentSequence,
				operation: row.operation,
				recordedAt: row.createdAt.toISOString(),
				snapshot: rootComponents.has(component)
					? { kind: "structure", value: publishingStructureRevisionValue(component, row.value) }
					: { kind: "child", value: publishingComponentRevisionValue(component, row.value) },
			}),
		);
	const page = domainPage(
		scope,
		items,
		input.limit,
		(row) => row.componentSequence,
		rows.length === input.limit,
	);
	if (page.items.length === items.length && rows.length === input.limit)
		page.nextCursor = encodeDomainCursor(scope, rows.at(-1)?.row.componentSequence);
	return page;
}
export async function restorePublishingApiHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: z.output<typeof PublishingHistoryComponentSchema>,
	componentKey: string,
	body: z.output<typeof PublishingRestoreSchema>,
) {
	await loadCatalogIdentity(tx, reference(id), actor, true);
	const table = CatalogStructureHistoryTables.publishing.history;
	const [row] = await tx
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
	if (!row) throw new CatalogReferenceNotFound("Publishing history is unavailable");
	const result = await restoreStructureComponent(tx, reference(id), actor, body.expectedRevision, {
		component,
		componentKey,
		expectedHistoryId: body.expectedHistoryId,
		historyId: body.historyId,
	});
	return mutation(tx, id, component, componentKey, result.revision);
}
/** @internal Indexed reverse coverage allows Work-to-publication browsing without a mandatory intermediate text version. */
export async function pagePublishingApiConnections(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.output<typeof PublishingConnectionsQuerySchema>,
) {
	await loadCatalogIdentity(tx, reference(id), actor, false);
	const scope = `publishing/${id}/connections/${input.kind}/${input.direction}`,
		after = decodeDomainCursor(scope, input.cursor, z.uuid());
	const incoming = input.direction === "incoming";
	const selected =
		input.kind === "serialization_text"
			? {
					table: publishingSerialization,
					from: publishingSerialization.id,
					to: publishingSerialization.textVersionId,
					position: null,
					coverage: null,
				}
			: input.kind === "text_work"
				? {
						table: publishingTextWork,
						from: publishingTextWork.textVersionId,
						to: publishingTextWork.workId,
						position: publishingTextWork.position,
						coverage: publishingTextWork.coverageText,
					}
				: input.kind === "publication_text"
					? {
							table: publishingPublicationText,
							from: publishingPublicationText.publicationId,
							to: publishingPublicationText.textVersionId,
							position: publishingPublicationText.position,
							coverage: publishingPublicationText.coverageText,
						}
					: {
							table: publishingPublicationWork,
							from: publishingPublicationWork.publicationId,
							to: publishingPublicationWork.workId,
							position: publishingPublicationWork.position,
							coverage: publishingPublicationWork.coverageText,
						};
	const source = incoming ? selected.to : selected.from,
		target = incoming ? selected.from : selected.to;
	const visibility = await visibleReference(tx, actor, "publishing", target);
	const result = await tx.execute(
		sql`select ${target} as id,${selected.position ?? sql`null`} as position,${selected.coverage ?? sql`null`} as coverage_text,${visibility} as readable from ${selected.table} where ${source}=${id}::uuid and ${target} is not null and ${after ? sql`${target}>${after}::uuid` : sql`true`} order by ${target} limit ${input.limit}`,
	);
	const rows = z
		.array(
			z.object({
				id: z.uuid(),
				position: z.coerce.number().int().nonnegative().nullable(),
				coverage_text: z.string().nullable(),
				readable: z.boolean(),
			}),
		)
		.parse(result.rows);
	const visible = rows.filter((row) => row.readable),
		labels = await readAuthorizedChildNameLabels(
			tx,
			"publishing",
			visible.map((row) => row.id),
		);
	const items = visible.map((row) =>
		PublishingConnectionSchema.parse({
			id: row.id,
			position: row.position,
			coverageText: row.coverage_text,
			name: labels.get(row.id) ?? null,
		}),
	);
	const page = domainPage(scope, items, input.limit, (row) => row.id, rows.length === input.limit);
	if (page.items.length === items.length && rows.length === input.limit)
		page.nextCursor = encodeDomainCursor(scope, rows.at(-1)?.id);
	return page;
}
