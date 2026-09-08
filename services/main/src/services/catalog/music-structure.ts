import { and, eq, inArray, isNull, or, getTableColumns, sql, type SQL } from "drizzle-orm";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { catalogAccessDecisions } from "../participation/policy";
import { catalogRatingReadable } from "./read-policy";
import { requireMusicCreditAccess } from "./music-credit-access";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { runParticipationSavepoint } from "../participation/policy";
import {
	musicAlternativeTrack,
	musicComponentRevision,
	musicComponentHead,
} from "../database/schema/catalog-music";
import type { CatalogReference } from "./contracts";
import { assertCatalogDefinitionTarget } from "./definitions";
import {
	assertMusicMediumFormatCompatibility,
	assertMusicMediumAttributeValue,
} from "./music-medium-attributes";
import { CatalogRevisionConflict, CatalogAccessDenied, CatalogReferenceNotFound, loadCatalogIdentity, recordCatalogChange } from "./storage";
import {
	MusicComponentBatchSchema,
	MusicSourceComponentBatchSchema,
	MusicComponentKeys,
	MusicComponentSchemas,
	musicComponentCompensation,
	musicComponentOwner,
	musicComponentKey,
	type MusicComponentChange,
	type MusicComponentMutation,
	type MusicComponentName,
} from "./music-structure-contracts";

/** @alpha Indexed exact child head; caller must hold the native owner write lock before using it as a write fence. */
export async function readMusicComponentHead(
	tx: DatabaseTransaction,
	ownerId: string,
	component: MusicComponentName,
	componentKey: string,
) {
	const table = musicComponentRevision;
	const head = musicComponentHead;
	const [row] = await tx
		.select(getTableColumns(table))
		.from(head)
		.innerJoin(table, and(eq(table.ownerId, head.ownerId), eq(table.id, head.historyId)))
		.where(
			and(
				eq(head.ownerId, ownerId),
				eq(head.component, component),
				eq(head.componentKey, componentKey),
			),
		)
		.limit(1);
	return row ?? null;
}

/** @internal Exact owner-local current heads, in pages of at most 128; no history scan. */
export async function readMusicComponentHeads(tx: DatabaseTransaction, ownerId: string,
	input: readonly { component: MusicComponentName; componentKey: string }[]) {
	if (input.length > 128) throw new RangeError("Music head lookup is limited to 128 keys");
	if (!input.length) return [];
	const table = musicComponentRevision, head = musicComponentHead;
	return tx.select(getTableColumns(table)).from(head)
		.innerJoin(table, and(eq(table.ownerId, head.ownerId), eq(table.id, head.historyId)))
		.where(and(eq(head.ownerId, ownerId), or(...input.map((item) => and(eq(head.component, item.component), eq(head.componentKey, item.componentKey))))))
		.limit(input.length);
}

type PreparedMusicMutation = { operation: MusicComponentMutation; head: Awaited<ReturnType<typeof readMusicComponentHead>>; row: Record<string, unknown>; remove: boolean };

async function validateSourceReferences(tx: DatabaseTransaction, actor: string, prepared: readonly PreparedMusicMutation[]) {
	for (const owner of ["music", "entity", "reference"] as const) {
		const ids = [...new Set(prepared.flatMap((item) => item.remove ? [] : [
			...["recording_id", "release_group_id"].filter(() => owner === "music"),
			...(owner === "entity" ? ["label_id"] : []), ...(owner === "reference" ? ["area_id"] : []),
		].flatMap((column) => typeof item.row[column] === "string" && (item.head?.operation === "DELETE" ? undefined : item.head?.value[column]) !== item.row[column] ? [z.uuid().parse(item.row[column])] : [])))];
		const table = CatalogIdentityTables[owner];
		for (let offset = 0; offset < ids.length; offset += 128) {
			const page = ids.slice(offset, offset + 128);
			const candidates = await tx.select().from(table).where(and(inArray(table.id, page), isNull(table.deletedAt))).limit(page.length).for("share");
			if (candidates.length !== page.length || candidates.some((row) => !catalogRatingReadable(row.contentRating))) throw new CatalogReferenceNotFound();
			const allowed = await catalogAccessDecisions(tx, candidates.map((row) => ({ reference: { owner, id: row.id }, createdByAuthUserId: row.createdByAuthUserId })), actor, false);
			if (candidates.some((row, index) => !allowed[index] && (row.visibility === "private" || row.status !== "published" || row.moderationStatus !== "approved"))) throw new CatalogAccessDenied();
		}
	}
}

async function validateReferences(
	tx: DatabaseTransaction,
	actor: string,
	component: MusicComponentName,
	row: Record<string, unknown>,
	current?: Record<string, unknown>,
	foreignReferencesValidated = false,
) {
	if (component === "music_medium_attribute") {
		await assertMusicMediumAttributeValue(
			tx,
			z.uuid().parse(row.release_id),
			z.uuid().parse(row.medium_id),
			row.text_value !== null
				? {
						valueMode: "text",
						definitionRevisionId: z.uuid().parse(row.definition_revision_id),
						textValue: z.string().parse(row.text_value),
					}
				: {
						valueMode: "vocabulary",
						definitionRevisionId: z.uuid().parse(row.definition_revision_id),
						valueRevisionId: z.uuid().parse(row.value_revision_id),
					},
		);
		return;
	}
	for (const [column, owner] of [
		["recording_id", "music"],
		["release_group_id", "music"],
		["label_id", "entity"],
		["area_id", "reference"],
	] as const) {
		const id = row[column];
		// Preserving an already validated edge does not read or grant access to its target.
		if (!foreignReferencesValidated && typeof id === "string" && current?.[column] !== id)
			await loadCatalogIdentity(tx, { owner, id }, actor, false);
	}
	for (const [column, value] of Object.entries(row)) {
		if (column.endsWith("_revision_id") && typeof value === "string")
			await assertCatalogDefinitionTarget(
				tx,
				value,
				"vocabulary",
				{ owner: "music", shape: musicComponentOwner(component).shape },
				`${component}.${column}`,
			);
	}
	if (component === "music_medium")
		await assertMusicMediumFormatCompatibility(
			tx,
			z.uuid().parse(row.release_id),
			z.uuid().parse(row.id),
			z.uuid().nullable().parse(row.format_revision_id),
		);
}

function rowPredicate(
	component: MusicComponentName,
	ownerId: string,
	row: Record<string, unknown>,
): SQL {
	const ownerColumn = musicComponentOwner(component).column;
	return sql.join(
		[
			sql`${sql.identifier(ownerColumn)} = ${ownerId}::uuid`,
			...MusicComponentKeys[component].map((key) =>
				!["id"].includes(key) && !key.endsWith("_id")
					? sql`${sql.identifier(key)} = ${z.string().parse(row[key])}`
					: sql`${sql.identifier(key)} = ${z.uuid().parse(row[key])}::uuid`,
			),
		],
		sql` and `,
	);
}

/**
 * @alpha Changes up to 128 native rows with exact child history fences, including structural restore.
 * @remarks Order deletions from children to parents and insertions from parents to children. A savepoint
 * rolls back all intermediate reorder positions and history if any reference, revision or SQL constraint fails.
 */
export async function mutateMusicComponents(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: readonly MusicComponentMutation[],
) {
	return mutatePreparedMusicComponents(tx, reference, actor, expectedRevision, MusicComponentBatchSchema.parse(input));
}

/** @internal Background source publication validates all heads and relocates all moving rows before applying any final position. */
export async function mutateMusicSourceComponents(
	tx: DatabaseTransaction, reference: CatalogReference, actor: string, expectedRevision: number,
	input: readonly MusicComponentMutation[],
) {
	return mutatePreparedMusicComponents(tx, reference, actor, expectedRevision, MusicSourceComponentBatchSchema.parse(input), 32_000_000);
}

async function mutatePreparedMusicComponents(
	tx: DatabaseTransaction, reference: CatalogReference, actor: string, expectedRevision: number,
	operations: MusicComponentMutation[], maximumHistoryBytes = Number.POSITIVE_INFINITY,
) {
	return runParticipationSavepoint(tx, async (inner) => {
		const identity = await loadCatalogIdentity(inner, reference, actor, true);
		if (reference.owner !== "music") throw new TypeError("Expected music storage owner");
		if (identity.revision !== expectedRevision)
			throw new CatalogRevisionConflict("Music owner revision changed");
		const prepared: PreparedMusicMutation[] = [];
		const bulk = Number.isFinite(maximumHistoryBytes);
		const heads = new Map<string, NonNullable<Awaited<ReturnType<typeof readMusicComponentHead>>>>();
		const restoreRows = new Map<string, NonNullable<Awaited<ReturnType<typeof readMusicComponentHead>>>>();
		let historyBytes = 0;
		if (bulk) {
			for (let offset = 0; offset < operations.length; offset += 128) {
				const page = operations.slice(offset, offset + 128);
				for (const head of await readMusicComponentHeads(inner, reference.id, page)) {
					historyBytes += Buffer.byteLength(JSON.stringify(head.value));
					if (historyBytes > maximumHistoryBytes) throw new RangeError("Music publication history exceeds its byte budget");
					heads.set(`${head.component}:${head.componentKey}`, head);
				}
				const restoreIds = page.flatMap((operation) => operation.action === "restore" ? [operation.historyId] : []);
				if (restoreIds.length) for (const history of await inner.select().from(musicComponentRevision)
					.where(and(eq(musicComponentRevision.ownerId, reference.id), inArray(musicComponentRevision.id, restoreIds))).limit(restoreIds.length)) {
					historyBytes += Buffer.byteLength(JSON.stringify(history.value));
					if (historyBytes > maximumHistoryBytes) throw new RangeError("Music publication history exceeds its byte budget");
					restoreRows.set(history.id, history);
				}
			}
		}
		for (const operation of operations) {
			if (identity.shape !== musicComponentOwner(operation.component).shape)
				throw new TypeError("Music component belongs to another native shape");
			const head = bulk ? heads.get(`${operation.component}:${operation.componentKey}`) ?? null : await readMusicComponentHead(
				inner,
				reference.id,
				operation.component,
				operation.componentKey,
			);
			if ((head?.id ?? null) !== operation.expectedRevisionId)
				throw new CatalogRevisionConflict("Music component revision changed");
			let value: unknown = operation.action === "put" ? operation.value : head?.value;
			let remove = operation.action === "remove";
			if (operation.action === "restore") {
				const [history] = bulk ? [restoreRows.get(operation.historyId)] : await inner
					.select()
					.from(musicComponentRevision)
					.where(
						and(
							eq(musicComponentRevision.ownerId, reference.id),
							eq(musicComponentRevision.id, operation.historyId),
							eq(musicComponentRevision.component, operation.component),
							eq(musicComponentRevision.componentKey, operation.componentKey),
						),
					)
					.limit(1);
				if (!history || history.component !== operation.component || history.componentKey !== operation.componentKey) throw new TypeError("History does not belong to the requested component");
				value = history.value;
				remove = history.operation === "DELETE";
			}
			if (!bulk && head) historyBytes += Buffer.byteLength(JSON.stringify(head.value));
			if (!bulk && operation.action === "restore") historyBytes += Buffer.byteLength(JSON.stringify(value));
			if (historyBytes > maximumHistoryBytes) throw new RangeError("Music publication history exceeds its byte budget");
			const row = MusicComponentSchemas[operation.component].parse(value);
			const body: Record<string, unknown> = row;
			const ownerId = body[musicComponentOwner(operation.component).column];
			if (
				ownerId !== reference.id ||
				musicComponentKey(operation.component, body) !== operation.componentKey
			)
				throw new TypeError("Component value has another owner or identity");
			if (musicComponentOwner(operation.component).column === "id" && remove)
				throw new TypeError("A native object header cannot be removed by a component command");
			if (remove && (!head || head.operation === "DELETE"))
				throw new TypeError("Cannot remove an absent component");
			prepared.push({ operation, head, row: body, remove });
		}
		for (let offset = 0; offset < prepared.length; offset += 128) {
		const page = prepared.slice(offset, offset + 128);
		const creditIds = page.flatMap((item) =>
			!item.remove && typeof item.row.artist_credit_id === "string"
				? [item.row.artist_credit_id]
				: [],
		);
		const alternativeIds = [
			...new Set(
				page.flatMap((item) =>
					!item.remove && typeof item.row.alternative_track_id === "string"
						? [item.row.alternative_track_id]
						: [],
				),
			),
		];
		if (alternativeIds.length) {
			const alternatives = await inner
				.select({ id: musicAlternativeTrack.id, creditId: musicAlternativeTrack.artistCreditId })
				.from(musicAlternativeTrack)
				.where(inArray(musicAlternativeTrack.id, alternativeIds))
				.limit(alternativeIds.length);
			if (alternatives.length !== alternativeIds.length)
				throw new TypeError("Alternative track is missing");
			for (const alternative of alternatives)
				if (alternative.creditId) creditIds.push(alternative.creditId);
		}
		await requireMusicCreditAccess(inner, actor, creditIds, {
			reference,
			write: true,
			historyIds: page.flatMap((item) => [
				...(item.head ? [item.head.id] : []),
				...(item.operation.action === "restore" ? [item.operation.historyId] : []),
			]),
		});
		}
		const revision = await recordCatalogChange(
			inner,
			reference,
			actor,
			expectedRevision,
			"music.structure.change",
		);
		// Positive spare positions satisfy existing nonnegative checks without weakening unique constraints.
		for (const component of ["music_medium", "music_track_occurrence"] as const) {
			const moving = prepared.filter(
				(item) =>
					item.operation.component === component &&
					item.head &&
					item.head.operation !== "DELETE" &&
					!item.remove &&
					(item.head.value.position !== item.row.position ||
						(component === "music_track_occurrence" &&
							item.head.value.medium_id !== item.row.medium_id)),
			);
			if (!moving.length) continue;
			const groups = new Map<string, typeof moving>();
			for (const item of moving) {
				const group =
					component === "music_medium" ? reference.id : z.uuid().parse(item.head?.value.medium_id);
				const members = groups.get(group) ?? [];
				members.push(item);
				groups.set(group, members);
			}
			for (const [group, members] of groups) {
				const result = await inner.execute(
					sql`select max(position)::text as maximum from ${sql.identifier(component)} where release_id = ${reference.id}::uuid ${component === "music_track_occurrence" ? sql`and medium_id = ${group}::uuid` : sql``}`,
				);
				const parsed = z.object({ maximum: z.string().nullable() }).parse(result.rows[0]);
				const maximum = Math.max(
					Number(parsed.maximum ?? 0),
					...prepared
						.filter((item) => item.operation.component === component && !item.remove)
						.map((item) => z.number().parse(item.row.position)),
				);
				if (!Number.isSafeInteger(maximum + members.length))
					throw new RangeError("No safe temporary reorder positions remain");
				for (let offset = 0; offset < members.length; offset += 128) {
					const page = members.slice(offset, offset + 128);
					if (bulk) await inner.execute(sql`update ${sql.identifier(component)} target set position=incoming.position
						from (values ${sql.join(page.map((item, index) => sql`(${z.uuid().parse(item.row.id)}::uuid,${maximum + offset + index + 1}::bigint)`), sql`,`)}) incoming(id,position)
						where target.release_id=${reference.id}::uuid and target.id=incoming.id`);
					else for (const [index, item] of page.entries()) await inner.execute(sql`update ${sql.identifier(component)} set position=${maximum + offset + index + 1} where ${rowPredicate(component, reference.id, item.row)}`);
				}
			}
		}
		if (bulk) {
			await validateSourceReferences(inner, actor, prepared);
			for (const item of prepared) if (!item.remove) await validateReferences(inner, actor, item.operation.component, item.row,
				item.head && item.head.operation !== "DELETE" ? MusicComponentSchemas[item.operation.component].parse(item.head.value) : undefined, true);
			await applyMusicSourceRows(inner, reference.id, prepared);
			const afterByKey = new Map<string, string>();
			for (let offset = 0; offset < prepared.length; offset += 128)
				for (const after of await readMusicComponentHeads(inner, reference.id, prepared.slice(offset, offset + 128).map((item) => item.operation)))
					afterByKey.set(`${after.component}:${after.componentKey}`, after.id);
			return { revision, changes: prepared.map((item) => {
				const afterRevisionId = afterByKey.get(`${item.operation.component}:${item.operation.componentKey}`);
				if (!afterRevisionId || afterRevisionId === item.head?.id) throw new Error("Native source mutation did not record an exact new head");
				return { component: item.operation.component, componentKey: item.operation.componentKey, beforeRevisionId: item.head?.id ?? null, afterRevisionId };
			}) };
		}
		const changes: MusicComponentChange[] = [];
		for (const { operation, head, row, remove } of prepared) {
			const table = sql.identifier(operation.component);
			if (remove)
				await inner.execute(
					sql`delete from ${table} where ${rowPredicate(operation.component, reference.id, row)}`,
				);
			else {
				await validateReferences(
					inner,
					actor,
					operation.component,
					row,
					head && head.operation !== "DELETE"
						? MusicComponentSchemas[operation.component].parse(head.value)
						: undefined,
				);
				const columns = Object.keys(row);
				const source = sql`jsonb_populate_record(null::${table}, ${JSON.stringify(row)}::jsonb)`;
				if (head && head.operation !== "DELETE") {
					const mutableColumns = columns.filter(
						(column) =>
							column !== musicComponentOwner(operation.component).column &&
							!MusicComponentKeys[operation.component].includes(column),
					);
					const mutable = mutableColumns.length
						? mutableColumns
						: [MusicComponentKeys[operation.component][0]!];
					await inner.execute(
						sql`update ${table} set ${sql.join(
							mutable.map(
								(column) => sql`${sql.identifier(column)} = incoming.${sql.identifier(column)}`,
							),
							sql`, `,
						)} from ${source} incoming where ${sql.join([sql`${table}.${sql.identifier(musicComponentOwner(operation.component).column)} = ${reference.id}::uuid`, ...MusicComponentKeys[operation.component].map((key) => sql`${table}.${sql.identifier(key)} = incoming.${sql.identifier(key)}`)], sql` and `)}`,
					);
				} else
					await inner.execute(
						sql`insert into ${table} (${sql.join(
							columns.map((column) => sql.identifier(column)),
							sql`, `,
						)}) select ${sql.join(
							columns.map((column) => sql.identifier(column)),
							sql`, `,
						)} from ${source}`,
					);
			}
			const after = await readMusicComponentHead(
				inner,
				reference.id,
				operation.component,
				operation.componentKey,
			);
			if (!after || after.id === head?.id)
				throw new Error("Native mutation did not record a new exact history head");
			changes.push({
				component: operation.component,
				componentKey: operation.componentKey,
				beforeRevisionId: head?.id ?? null,
				afterRevisionId: after.id,
			});
		}
		return { revision, changes };
	});
}

// SQL pages share the outer publication transaction. Dependency order applies across every page.
async function applyMusicSourceRows(tx: DatabaseTransaction, ownerId: string, input: readonly PreparedMusicMutation[]) {
	const rank = (component: MusicComponentName) => musicComponentOwner(component).column === "id" ? 0
		: component === "music_medium" ? 1 : component === "music_release_presentation" || component === "music_track_occurrence" ? 2
			: component === "music_medium_presentation" ? 3 : component === "music_track_presentation" ? 4 : 5;
	const groups = new Map<string, PreparedMusicMutation[]>();
	for (const item of input) {
		const action = item.remove ? "remove" : item.head && item.head.operation !== "DELETE" ? "update" : "insert";
		const key = `${action}:${item.operation.component}`;
		const group = groups.get(key) ?? []; group.push(item); groups.set(key, group);
	}
	const ordered = [...groups.entries()].sort(([a, left], [b, right]) => {
		const removeA = a.startsWith("remove:"), removeB = b.startsWith("remove:");
		return removeA !== removeB ? removeA ? -1 : 1 : (rank(left[0]!.operation.component) - rank(right[0]!.operation.component)) * (removeA ? -1 : 1);
	});
	for (const [groupKey, items] of ordered) {
		const component = items[0]!.operation.component, table = sql.identifier(component);
		const columns = Object.keys(items[0]!.row), ownerColumn = musicComponentOwner(component).column;
		const predicate = sql.join([sql`target.${sql.identifier(ownerColumn)}=${ownerId}::uuid`,
			...MusicComponentKeys[component].map((key) => sql`target.${sql.identifier(key)}=incoming.${sql.identifier(key)}`)], sql` and `);
		for (let offset = 0; offset < items.length;) {
			const page: PreparedMusicMutation[] = []; let bytes = 0;
			while (offset < items.length && page.length < 128) {
				const item = items[offset]!; const size = Buffer.byteLength(JSON.stringify(item.row));
				if (size > 2_000_000) throw new RangeError("Music source row exceeds its SQL page budget");
				if (page.length && bytes + size > 2_000_000) break;
				page.push(item); bytes += size; offset++;
			}
			const source = sql`jsonb_populate_recordset(null::${table},${JSON.stringify(page.map((item) => item.row))}::jsonb)`;
			if (groupKey.startsWith("remove:")) await tx.execute(sql`delete from ${table} target using ${source} incoming where ${predicate}`);
			else if (groupKey.startsWith("update:")) {
				const mutable = columns.filter((column) => column !== ownerColumn && !MusicComponentKeys[component].includes(column));
				const updated = mutable.length ? mutable : [MusicComponentKeys[component][0]!];
				await tx.execute(sql`update ${table} target set ${sql.join(updated.map((column) => sql`${sql.identifier(column)}=incoming.${sql.identifier(column)}`), sql`,`)} from ${source} incoming where ${predicate}`);
			} else await tx.execute(sql`insert into ${table} (${sql.join(columns.map((column) => sql.identifier(column)), sql`,`)}) select ${sql.join(columns.map((column) => sql.identifier(column)), sql`,`)} from ${source}`);
		}
	}
}

/** @alpha Compensates precisely the rows changed by an application; independent edits reject the entire batch. */
export async function compensateMusicComponents(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	changes: readonly MusicComponentChange[],
) {
	return mutateMusicComponents(
		tx,
		reference,
		actor,
		expectedRevision,
		musicComponentCompensation(changes),
	);
}
