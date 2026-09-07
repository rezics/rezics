import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	musicArtistCredit,
	musicAlternativeTrack,
	musicComponentRevision,
} from "../database/schema/catalog-music";
import type { CatalogReference } from "./contracts";
import { assertCatalogDefinitionRevision } from "./definitions";
import { assertMusicMediumFormatCompatibility } from "./music-medium-attributes";
import {
	CatalogAccessDenied,
	CatalogRevisionConflict,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";
import {
	MusicComponentBatchSchema,
	MusicComponentKeys,
	MusicComponentSchemas,
	musicComponentCompensation,
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
	const [row] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, ownerId),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
			),
		)
		.orderBy(desc(table.id))
		.limit(1);
	return row ?? null;
}

async function readableCredit(tx: DatabaseTransaction, actor: string, id: string) {
	const [credit] = await tx
		.select()
		.from(musicArtistCredit)
		.where(eq(musicArtistCredit.id, id))
		.limit(1);
	if (
		!credit?.sealedAt ||
		credit.retiredAt ||
		(!credit.publiclyReusable && credit.createdByAuthUserId !== actor)
	)
		throw new CatalogAccessDenied("Artist credit is not available to this actor");
}

async function validateReferences(
	tx: DatabaseTransaction,
	actor: string,
	component: MusicComponentName,
	row: Record<string, unknown>,
) {
	for (const [column, owner] of [
		["recording_id", "music"],
		["release_group_id", "music"],
		["label_id", "entity"],
		["area_id", "reference"],
	] as const) {
		const id = row[column];
		if (typeof id === "string") await loadCatalogIdentity(tx, { owner, id }, actor, false);
	}
	for (const [column, value] of Object.entries(row)) {
		if (column.endsWith("_revision_id") && typeof value === "string")
			await assertCatalogDefinitionRevision(tx, value, "vocabulary");
	}
	if (typeof row.artist_credit_id === "string")
		await readableCredit(tx, actor, row.artist_credit_id);
	if (typeof row.alternative_track_id === "string") {
		const [alternative] = await tx
			.select()
			.from(musicAlternativeTrack)
			.where(eq(musicAlternativeTrack.id, row.alternative_track_id))
			.limit(1);
		if (!alternative) throw new TypeError("Alternative track is missing");
		if (alternative.artistCreditId) await readableCredit(tx, actor, alternative.artistCreditId);
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
	const ownerColumn = component === "music_release" ? "id" : "release_id";
	return sql.join(
		[
			sql`${sql.identifier(ownerColumn)} = ${ownerId}::uuid`,
			...MusicComponentKeys[component].map((key) =>
				["namespace", "value"].includes(key)
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
	const operations = MusicComponentBatchSchema.parse(input);
	return tx.transaction(async (inner) => {
		const identity = await loadCatalogIdentity(inner, reference, actor, true);
		if (reference.owner !== "music" || identity.shape !== "release")
			throw new TypeError("Expected a music release");
		if (identity.revision !== expectedRevision)
			throw new CatalogRevisionConflict("Music owner revision changed");
		const prepared = [];
		for (const operation of operations) {
			const head = await readMusicComponentHead(
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
				const [history] = await inner
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
				if (!history) throw new TypeError("History does not belong to the requested component");
				value = history.value;
				remove = history.operation === "DELETE";
			}
			const row = MusicComponentSchemas[operation.component].parse(value);
			const ownerId = "release_id" in row ? row.release_id : row.id;
			const body: Record<string, unknown> = row;
			if (
				ownerId !== reference.id ||
				MusicComponentKeys[operation.component].map((key) => body[key]).join("/") !==
					operation.componentKey
			)
				throw new TypeError("Component value has another owner or identity");
			if (operation.component === "music_release" && remove)
				throw new TypeError("A release header cannot be removed by a component command");
			if (remove && (!head || head.operation === "DELETE"))
				throw new TypeError("Cannot remove an absent component");
			if (!remove) await validateReferences(inner, actor, operation.component, body);
			prepared.push({ operation, head, row: body, remove });
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
					!item.remove,
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
				for (const [index, item] of members.entries())
					await inner.execute(
						sql`update ${sql.identifier(component)} set position = ${maximum + index + 1} where ${rowPredicate(component, reference.id, item.row)}`,
					);
			}
		}
		const changes: MusicComponentChange[] = [];
		for (const { operation, head, row, remove } of prepared) {
			const table = sql.identifier(operation.component);
			if (remove)
				await inner.execute(
					sql`delete from ${table} where ${rowPredicate(operation.component, reference.id, row)}`,
				);
			else {
				const columns = Object.keys(row);
				const source = sql`jsonb_populate_record(null::${table}, ${JSON.stringify(row)}::jsonb)`;
				if (head && head.operation !== "DELETE") {
					const mutableColumns = columns.filter(
						(column) =>
							column !== "release_id" && !MusicComponentKeys[operation.component].includes(column),
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
						)} from ${source} incoming where ${sql.join([sql`${table}.${sql.identifier(operation.component === "music_release" ? "id" : "release_id")} = ${reference.id}::uuid`, ...MusicComponentKeys[operation.component].map((key) => sql`${table}.${sql.identifier(key)} = incoming.${sql.identifier(key)}`)], sql` and `)}`,
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
