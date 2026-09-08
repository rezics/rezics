import { and, eq, gt, lt, desc, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { canAccessCatalog } from "../participation/policy";
import {
	softwareComponentRevision,
	softwareParticipationContext,
	softwareParticipationContextRevision,
} from "../database/schema/catalog-software";
import { loadCatalogIdentity, CatalogReferenceNotFound } from "./storage";
import {
	readSoftwareDetails,
	reviseSoftwareContent,
	reviseSoftwareVersion,
	reviseSoftwareRelease,
	SoftwareContentDetailsSchema,
	SoftwareVersionDetailsSchema,
	readSoftwareHistory,
	readSoftwareReleaseComponents,
	readSoftwareComponentHistory,
	decodeSoftwareReleaseSnapshot,
	findSoftwareReleases,
} from "./software";
import { decodeSoftwareComponentSnapshot } from "./software-components";
import { readSoftwareAnimation } from "./software-animation";
import {
	readSoftwareParticipations,
	readSoftwareParticipationHistory,
} from "./software-participation";
import { readSoftwareParticipationContextHistory } from "./software-contexts";
import {
	SoftwareDetailSchema,
	SoftwareDetailValueSchema,
	SoftwareComponentSchema,
	SoftwareComponentHistorySchema,
	SoftwareDetailHistorySchema,
	SoftwareCreditSchema,
	SoftwareContextSchema,
	SoftwareChildHistorySchema,
	SoftwareDetailEditSchema,
	SoftwarePageQuerySchema,
	SoftwareChildrenQuerySchema,
	SoftwareComponentKindSchema,
	SoftwareReleaseSearchSchema,
	SoftwareReleaseSummarySchema,
	NativeRevisionSchema,
} from "./software-api-contracts";
import { decodeDomainCursor, domainPage, lockDomainSnapshot } from "./domain-api-pagination";
const ref = (id: string) => ({ owner: "software" as const, id: z.uuid().parse(id) });
const snake = (input: unknown) =>
	Object.fromEntries(
		Object.entries(z.record(z.string(), z.unknown()).parse(input)).map(([key, value]) => [
			key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
			value,
		]),
	);
function details(kind: "content" | "version" | "release", raw: unknown) {
	const value = z.record(z.string(), z.unknown()).parse(raw);
	return SoftwareDetailValueSchema.parse(
		kind === "content"
			? {
					kind,
					value: SoftwareContentDetailsSchema.parse({
						originalLanguageTag: value.original_language_tag,
						developmentStatus: value.development_status,
						description: value.description,
					}),
				}
			: kind === "version"
				? {
						kind,
						value: SoftwareVersionDetailsSchema.parse({
							kind: value.kind,
							versionLabel: value.version_label,
							languageTag: value.language_tag,
							distinguishingEvidence: value.distinguishing_evidence,
						}),
					}
				: { kind, value: decodeSoftwareReleaseSnapshot(value) },
	);
}
/** @internal HTTP DTOs include only native domain values, never raw identity/Auth storage columns. */
export async function readSoftwareApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
) {
	await lockDomainSnapshot(tx, ref(id));
	const result = await readSoftwareDetails(tx, ref(id), actor);
	if (!result.value) throw new CatalogReferenceNotFound("Software details are not initialized");
	return SoftwareDetailSchema.parse({
		canEdit: await canAccessCatalog(tx, ref(id), actor, result.identity.createdByAuthUserId, true),
		id,
		revision: result.identity.revision,
		contentId: result.kind === "version" ? result.value.contentId : null,
		details: details(result.kind, snake(result.value)),
	});
}
export async function updateSoftwareApiDetails(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.output<typeof SoftwareDetailEditSchema>,
) {
	const body = SoftwareDetailEditSchema.parse(input),
		reference = ref(id);
	switch (body.details.kind) {
		case "content":
			return reviseSoftwareContent(tx, reference, actor, body.expectedRevision, body.details.value);
		case "version":
			return reviseSoftwareVersion(tx, reference, actor, body.expectedRevision, body.details.value);
		case "release":
			return reviseSoftwareRelease(tx, reference, actor, body.expectedRevision, body.details.value);
	}
}
export async function pageSoftwareApiHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.output<typeof SoftwarePageQuerySchema>,
) {
	await loadCatalogIdentity(tx, ref(id), actor, true);
	const scope = `software/${id}/history`,
		before = decodeDomainCursor(scope, input.cursor, NativeRevisionSchema);
	const rows = await readSoftwareHistory(tx, ref(id), actor, {
		limit: input.limit,
		beforeRevision: before === undefined ? undefined : NativeRevisionSchema.parse(before),
	});
	return domainPage(
		scope,
		rows.map((row) =>
			SoftwareDetailHistorySchema.parse({
				revision: row.revision,
				recordedAt: row.createdAt.toISOString(),
				details: details(row.shape, row.value),
			}),
		),
		input.limit,
		(row) => row.revision,
	);
}
export async function pageSoftwareApiComponents(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	kind: z.output<typeof SoftwareComponentKindSchema>,
	input: z.output<typeof SoftwarePageQuerySchema>,
) {
	await lockDomainSnapshot(tx, ref(id));
	const scope = `software/${id}/components/${kind}`,
		after = decodeDomainCursor(
			scope,
			input.cursor,
			kind === "animation" ? z.string().max(96) : z.uuid(),
		);
	const raw =
		kind === "animation"
			? (await readSoftwareAnimation(tx, ref(id), actor))
					.filter((row) => after === undefined || row.context > z.string().parse(after))
					.slice(0, input.limit)
			: await readSoftwareReleaseComponents(tx, ref(id), actor, kind, {
					limit: input.limit,
					afterId: after === undefined ? undefined : z.uuid().parse(after),
				});
	const items = raw.map((row) => {
		const value = z.record(z.string(), z.unknown()).parse(row);
		return {
			id: z
				.string()
				.parse(
					kind === "platform"
						? value.platformRevisionId
						: kind === "patch_target"
							? value.baseReleaseId
							: kind === "animation"
								? value.context
								: value.id,
				),
			value: decodeSoftwareComponentSnapshot(kind, snake(row)),
		};
	});
	if (!items.length) return { items: [], nextCursor: null };
	const history = await tx.execute(
		sql`select selected.id, latest.revision from unnest(${sql.param(items.map((item) => item.id))}::text[]) selected(id) cross join lateral (select revision from ${softwareComponentRevision} where release_id=${id}::uuid and kind=${kind} and component_id=selected.id order by revision desc limit 1) latest`,
	);
	const heads = new Map(
		z
			.array(z.object({ id: z.string(), revision: z.coerce.number().int().positive().safe() }))
			.parse(history.rows)
			.map((row) => [row.id, row.revision]),
	);
	return domainPage(
		scope,
		items.map((item) => SoftwareComponentSchema.parse({ ...item, revision: heads.get(item.id) })),
		input.limit,
		(row) => row.id,
	);
}
export async function pageSoftwareApiComponentHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	kind: z.output<typeof SoftwareComponentKindSchema>,
	componentId: string,
	input: z.output<typeof SoftwarePageQuerySchema>,
) {
	await loadCatalogIdentity(tx, ref(id), actor, true);
	const scope = `software/${id}/components/${kind}/${componentId}/history`,
		after = decodeDomainCursor(scope, input.cursor, NativeRevisionSchema),
		beforeRevision = after === undefined ? undefined : NativeRevisionSchema.parse(after);
	const table = softwareComponentRevision;
	const rows =
		kind === "animation"
			? await tx
					.select()
					.from(table)
					.where(
						and(
							eq(table.releaseId, id),
							eq(table.kind, kind),
							eq(table.componentId, componentId),
							beforeRevision === undefined ? undefined : lt(table.revision, beforeRevision),
						),
					)
					.orderBy(desc(table.revision))
					.limit(input.limit)
			: await readSoftwareComponentHistory(tx, ref(id), actor, kind, componentId, {
					limit: input.limit,
					beforeRevision,
				});
	return domainPage(
		scope,
		rows.map((row) =>
			SoftwareComponentHistorySchema.parse({
				id: row.componentId,
				revision: row.revision,
				operation: row.operation,
				value: decodeSoftwareComponentSnapshot(kind, row.value),
			}),
		),
		input.limit,
		(row) => row.revision,
	);
}
export function presentSoftwareContext(row: {
	contextId: string;
	revision: number;
	label: string | null;
	languageTag: string | null;
	state: string;
}) {
	return SoftwareContextSchema.parse({
		id: row.contextId,
		revision: row.revision,
		value: { label: row.label, languageTag: row.languageTag, state: row.state },
	});
}
export function presentSoftwareCredit(row: {
	participationId: string;
	revision: number;
	entityId: string;
	nameId: string | null;
	nameRevision: number | null;
	contextId: string | null;
	contextRevision: number | null;
	characterId: string | null;
	roleRevisionId: string;
	note: string | null;
	state: string;
}) {
	return SoftwareCreditSchema.parse({
		id: row.participationId,
		revision: row.revision,
		value: {
			entityId: row.entityId,
			name: row.nameId && row.nameRevision ? { id: row.nameId, revision: row.nameRevision } : null,
			context:
				row.contextId && row.contextRevision
					? { id: row.contextId, revision: row.contextRevision }
					: null,
			characterId: row.characterId,
			roleRevisionId: row.roleRevisionId,
			note: row.note,
			state: row.state,
		},
	});
}
export async function pageSoftwareApiContexts(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.output<typeof SoftwareChildrenQuerySchema>,
) {
	const identity = await loadCatalogIdentity(tx, ref(id), actor, input.includeWithdrawn === true);
	if (identity.shape !== "content")
		throw new TypeError("Participation contexts require software content");
	const scope = `software/${id}/contexts/${input.includeWithdrawn === true}`,
		after = decodeDomainCursor(scope, input.cursor, z.uuid()),
		head = softwareParticipationContext,
		revision = softwareParticipationContextRevision;
	const rows = await tx
		.select({ value: revision })
		.from(head)
		.innerJoin(
			revision,
			and(
				eq(revision.contentId, head.contentId),
				eq(revision.contextId, head.id),
				eq(revision.revision, head.currentRevision),
			),
		)
		.where(
			and(
				eq(head.contentId, id),
				input.includeWithdrawn ? undefined : eq(revision.state, "active"),
				after === undefined ? undefined : gt(head.id, z.uuid().parse(after)),
			),
		)
		.orderBy(head.id)
		.limit(input.limit);
	return domainPage(
		scope,
		rows.map((row) => presentSoftwareContext(row.value)),
		input.limit,
		(row) => row.id,
	);
}
export async function pageSoftwareApiCredits(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.output<typeof SoftwareChildrenQuerySchema>,
) {
	const scope = `software/${id}/credits/${input.includeWithdrawn === true}`,
		after = decodeDomainCursor(scope, input.cursor, z.uuid());
	const rows = await readSoftwareParticipations(tx, ref(id), actor, {
		limit: input.limit,
		afterId: after === undefined ? undefined : z.uuid().parse(after),
		includeWithdrawn: input.includeWithdrawn,
	});
	return domainPage(scope, rows.map(presentSoftwareCredit), input.limit, (row) => row.id);
}
export async function pageSoftwareApiChildHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	family: "context" | "credit",
	childId: string,
	input: z.output<typeof SoftwarePageQuerySchema>,
) {
	await loadCatalogIdentity(tx, ref(id), actor, true);
	const scope = `software/${id}/${family}/${childId}/history`,
		after = decodeDomainCursor(scope, input.cursor, NativeRevisionSchema),
		query = {
			limit: input.limit,
			afterRevision: after === undefined ? undefined : NativeRevisionSchema.parse(after),
		};
	const items =
		family === "context"
			? (await readSoftwareParticipationContextHistory(tx, ref(id), actor, childId, query)).map(
					(row) =>
						SoftwareChildHistorySchema.parse({
							...presentSoftwareContext(row),
							recordedAt: row.createdAt.toISOString(),
						}),
				)
			: (await readSoftwareParticipationHistory(tx, ref(id), actor, childId, query)).map((row) =>
					SoftwareChildHistorySchema.parse({
						...presentSoftwareCredit(row),
						recordedAt: row.createdAt.toISOString(),
					}),
				);
	return domainPage(scope, items, input.limit, (row) => row.revision);
}
export async function pageSoftwareApiReleases(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.output<typeof SoftwareReleaseSearchSchema>,
) {
	const { cursor, limit, ...filters } = input,
		scope = `software/${id}/releases/${JSON.stringify(filters)}`,
		after = decodeDomainCursor(scope, cursor, z.uuid());
	const rows = await findSoftwareReleases(tx, ref(id), actor, {
		...filters,
		limit,
		afterId: after === undefined ? undefined : z.uuid().parse(after),
	});
	return domainPage(
		scope,
		rows.map((row) => SoftwareReleaseSummarySchema.parse(row)),
		limit,
		(row) => row.id,
	);
}
