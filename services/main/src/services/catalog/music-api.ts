import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	musicArtistCredit,
	musicComponentHead,
	musicComponentRevision,
	musicReleaseEvent,
	musicReleaseLabel,
} from "../database/schema/catalog-music";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import {
	canAccessCatalog,
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	ParticipationDenied,
} from "../participation/policy";
import {
	readMusicReleaseMetadata,
	readMusicRecordingMetadata,
	readMusicWorkMetadata,
	readMusicReleaseGroupMetadata,
	listMusicWorkLanguages,
	listMusicMedia,
} from "./music-domain";
import { readMusicReleaseCandidate, listMusicCandidateTracks } from "./music-candidates";
import { readMusicTracks } from "./domains";
import { loadCatalogIdentity, CatalogReferenceNotFound, CatalogRevisionConflict } from "./storage";
import { pageCatalogNames } from "./resources";
import { catalogWirePage } from "./resource-pagination";
import { listMusicComponentRevisions } from "./music-history";
import {
	MusicDetailSchema,
	MusicPositionQuerySchema,
	MusicHistoryQuerySchema,
	MusicHistoryPageSchema,
	MusicHeaderPatchSchema,
	MusicEditMediumSchema,
	MusicEditTrackSchema,
} from "./music-api-contracts";
import {
	MusicComponentNameSchema,
	MusicComponentSchemas,
	MusicComponentKeys,
	musicComponentOwner,
	musicComponentKey,
	type MusicComponentName,
} from "./music-structure-contracts";
import {
	MusicStructureQuerySchema,
	MusicStructurePageSchema,
	MusicRestoreSchema,
} from "./music-api-contracts";
import { readMusicComponentHead, mutateMusicComponents } from "./music-structure";

const reference = (id: string) => ({ owner: "music" as const, id: z.uuid().parse(id) });
async function heads(tx: DatabaseTransaction, id: string, component: string, keys: string[]) {
	if (!keys.length) return new Map<string, string>();
	const t = musicComponentHead;
	const rows = await tx
		.select({ key: t.componentKey, head: t.historyId })
		.from(t)
		.where(and(eq(t.ownerId, id), eq(t.component, component), inArray(t.componentKey, keys)))
		.limit(keys.length);
	return new Map(rows.map((row) => [row.key, row.head]));
}
function positionPage<T extends { id: string; position: number }>(
	rows: T[],
	limit: number,
	revision: number,
) {
	const page = catalogWirePage(
		rows.map((row) => ({ id: String(row.position), value: row })),
		limit,
	);
	return {
		items: page.items,
		nextCursor: page.nextCursor === null ? null : Number(page.nextCursor),
		revision,
	};
}
/** @alpha Bounded native carrier page, including exact edit heads. */
export async function pageMusicMedia(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	input: z.input<typeof MusicPositionQuerySchema>,
) {
	const value = MusicPositionQuerySchema.parse(input),
		ref = reference(id);
	const identity = await loadCatalogIdentity(tx, ref, actor, false);
	const rows = await listMusicMedia(tx, ref, actor, { ...value, limit: value.limit + 1 });
	const current = await heads(
		tx,
		id,
		"music_medium",
		rows.map((row) => row.id),
	);
	return positionPage(
		rows.map((row) => ({ ...row, headId: current.get(row.id) ?? null })),
		value.limit,
		identity.revision,
	);
}
/** @alpha A track's printed number, duration and recording reference remain independent. */
export async function pageMusicTracks(
	tx: DatabaseTransaction,
	id: string,
	mediumId: string,
	actor: string | null,
	input: z.input<typeof MusicPositionQuerySchema>,
) {
	const value = MusicPositionQuerySchema.parse(input),
		ref = reference(id);
	const identity = await loadCatalogIdentity(tx, ref, actor, false);
	const rows = await readMusicTracks(
		tx,
		ref,
		actor,
		z.uuid().parse(mediumId),
		value.afterPosition,
		value.limit + 1,
	);
	const current = await heads(
		tx,
		id,
		"music_track_occurrence",
		rows.map((row) => row.id),
	);
	return positionPage(
		rows.map((row) => ({ ...row, headId: current.get(row.id) ?? null })),
		value.limit,
		identity.revision,
	);
}
/** @alpha Public detail selects one owner and at most one initial track page, never all album descendants. */
export async function readMusicDetail(tx: DatabaseTransaction, id: string, actor: string | null) {
	const ref = reference(id),
		identity = await loadCatalogIdentity(tx, ref, actor, false);
	let canEdit = false;
	try {
		canEdit = await canAccessCatalog(tx, ref, actor, identity.createdByAuthUserId, true);
	} catch (error) {
		if (!(error instanceof ParticipationDenied)) throw error;
	}
	const names = await pageCatalogNames(tx, ref, actor, { limit: 10, maxSpoiler: 0 });
	const title =
		names.items.find((name) => name.kind === "source-primary" || name.kind === "primary")?.value ??
		names.items[0]?.value ??
		null;
	const currentHeads = await heads(tx, id, `music_${identity.shape}`, [id]);
	const base = {
		id,
		revision: identity.revision,
		headId: currentHeads.get(id) ?? null,
		canEdit,
		title,
		credit: null as string | null,
	};
	const credit = async (creditId: string | null) => {
		if (!creditId) return null;
		const [row] = await tx
			.select({ name: musicArtistCredit.renderedName })
			.from(musicArtistCredit)
			.where(eq(musicArtistCredit.id, creditId))
			.limit(1);
		return row?.name ?? null;
	};
	switch (identity.shape) {
		case "release": {
			const metadata = await readMusicReleaseMetadata(tx, ref, actor),
				media = await pageMusicMedia(tx, id, actor, {});
			const tracks = media.items[0]
				? await pageMusicTracks(tx, id, media.items[0].id, actor, {})
				: null;
			const scope = await readCatalogAuthorityScope(tx, actor),
				entity = CatalogIdentityTables.entity,
				area = CatalogIdentityTables.reference;
			const labels = await tx
				.select({
					id: musicReleaseLabel.id,
					releaseId: musicReleaseLabel.releaseId,
					catalogNumber: musicReleaseLabel.catalogNumber,
					labelId: sql<
						string | null
					>`case when exists(select 1 from ${entity} where ${entity.id}=${musicReleaseLabel.labelId} and ${catalogIdentityReadPredicate(scope, "entity", entity)}) then ${musicReleaseLabel.labelId} else null end`,
				})
				.from(musicReleaseLabel)
				.where(eq(musicReleaseLabel.releaseId, id))
				.orderBy(musicReleaseLabel.id)
				.limit(50);
			const dates = await tx
				.select({
					id: musicReleaseEvent.id,
					releaseId: musicReleaseEvent.releaseId,
					dateYear: musicReleaseEvent.dateYear,
					dateMonth: musicReleaseEvent.dateMonth,
					dateDay: musicReleaseEvent.dateDay,
					dateText: musicReleaseEvent.dateText,
					areaId: sql<
						string | null
					>`case when exists(select 1 from ${area} where ${area.id}=${musicReleaseEvent.areaId} and ${catalogIdentityReadPredicate(scope, "reference", area)}) then ${musicReleaseEvent.areaId} else null end`,
				})
				.from(musicReleaseEvent)
				.where(eq(musicReleaseEvent.releaseId, id))
				.orderBy(musicReleaseEvent.id)
				.limit(50);
			return MusicDetailSchema.parse({
				...base,
				kind: "release",
				metadata,
				media,
				tracks,
				labels,
				dates,
				credit: await credit(metadata.artistCreditId),
			});
		}
		case "recording": {
			const metadata = await readMusicRecordingMetadata(tx, ref, actor);
			return MusicDetailSchema.parse({
				...base,
				kind: "recording",
				metadata,
				credit: await credit(metadata.artistCreditId),
			});
		}
		case "release_group": {
			const metadata = await readMusicReleaseGroupMetadata(tx, ref, actor);
			return MusicDetailSchema.parse({
				...base,
				kind: "release_group",
				metadata,
				credit: await credit(metadata.artistCreditId),
			});
		}
		case "work": {
			const metadata = await readMusicWorkMetadata(tx, ref, actor);
			const languages = (await listMusicWorkLanguages(tx, ref, actor, { limit: 50 })).map(
				(row) => row.languageTag,
			);
			return MusicDetailSchema.parse({ ...base, kind: "work", metadata, languages });
		}
		case "release_candidate": {
			const metadata = await readMusicReleaseCandidate(tx, ref, actor);
			const tracks = await listMusicCandidateTracks(tx, ref, actor, -1, 50);
			return MusicDetailSchema.parse({ ...base, kind: "release_candidate", metadata, tracks });
		}
		default:
			throw new CatalogReferenceNotFound("Music object shape is not available");
	}
}

const fieldNames: Readonly<Record<string, string>> = {
	position: "position",
	name: "name",
	number: "number",
	barcode: "barcode",
	video: "video",
	mediumId: "medium_id",
	recordingId: "recording_id",
	releaseGroupId: "release_group_id",
	artistCreditId: "artist_credit_id",
	lengthMilliseconds: "length_milliseconds",
	isDataTrack: "is_data_track",
	formatRevisionId: "format_revision_id",
	sourceTrackCount: "source_track_count",
	languageTag: "language_tag",
	scriptCode: "script_code",
	statusRevisionId: "status_revision_id",
	packagingRevisionId: "packaging_revision_id",
	typeRevisionId: "type_revision_id",
	primaryTypeRevisionId: "primary_type_revision_id",
};
async function patch(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	component: MusicComponentName,
	key: string,
	input: { expectedRevision: number; expectedHeadId: string; value: Record<string, unknown> },
) {
	const ref = reference(id);
	await loadCatalogIdentity(tx, ref, actor, true);
	const head = await readMusicComponentHead(tx, id, component, key);
	if (!head || head.operation === "DELETE")
		throw new CatalogReferenceNotFound("Music component is missing");
	if (head.id !== input.expectedHeadId)
		throw new CatalogRevisionConflict("Music component changed");
	const value = { ...head.value };
	for (const [field, supplied] of Object.entries(input.value)) {
		if (supplied === undefined) continue;
		const native = fieldNames[field];
		if (!native) throw new TypeError("Unknown music field");
		value[native] = supplied;
	}
	return mutateMusicComponents(tx, ref, actor, input.expectedRevision, [
		{ action: "put", component, componentKey: key, expectedRevisionId: head.id, value },
	]);
}
/** @alpha Partial edits preserve hidden existing references; new references require native read authority. */
export function patchMusicHeader(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.input<typeof MusicHeaderPatchSchema>,
) {
	const value = MusicHeaderPatchSchema.parse(input);
	return patch(tx, id, actor, MusicComponentNameSchema.parse(`music_${value.kind}`), id, value);
}
export function patchMusicMedium(
	tx: DatabaseTransaction,
	id: string,
	mediumId: string,
	actor: string,
	input: z.input<typeof MusicEditMediumSchema>,
) {
	return patch(
		tx,
		id,
		actor,
		"music_medium",
		z.uuid().parse(mediumId),
		MusicEditMediumSchema.parse(input),
	);
}
export function patchMusicTrack(
	tx: DatabaseTransaction,
	id: string,
	trackId: string,
	actor: string,
	input: z.input<typeof MusicEditTrackSchema>,
) {
	return patch(
		tx,
		id,
		actor,
		"music_track_occurrence",
		z.uuid().parse(trackId),
		MusicEditTrackSchema.parse(input),
	);
}
/** @alpha Editor history remains paged and restores through exact native heads. */
export async function pageMusicHistory(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.input<typeof MusicHistoryQuerySchema>,
) {
	const value = MusicHistoryQuerySchema.parse(input);
	const rows = await listMusicComponentRevisions(
		tx,
		reference(id),
		actor,
		value.component,
		value.componentKey,
		{ afterId: value.afterId, limit: value.limit + 1 },
	);
	return MusicHistoryPageSchema.parse(
		catalogWirePage(
			rows.map((row, index) => ({
				id: row.id,
				value: {
					id: row.id,
					component: row.component,
					componentKey: row.componentKey,
					componentSequence: row.componentSequence,
					ownerRevision: row.ownerRevision,
					operation: row.operation,
					value: row.value,
					recordedAt: row.recordedAt.toISOString(),
					restorable: rows[index + 1]?.ownerRevision !== row.ownerRevision,
				},
			})),
			value.limit,
		),
	);
}

/** @alpha Intermediate uniqueness-preserving reorder positions are audit records, not authored restore targets. */
export async function restoreMusicComponent(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.input<typeof MusicRestoreSchema>,
) {
	const value = MusicRestoreSchema.parse(input),
		ref = reference(id),
		t = musicComponentRevision;
	await loadCatalogIdentity(tx, ref, actor, true);
	const [history] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.ownerId, id),
				eq(t.id, value.historyId),
				eq(t.component, value.component),
				eq(t.componentKey, value.componentKey),
			),
		)
		.limit(1);
	if (!history) throw new CatalogReferenceNotFound("Music history is missing");
	const [next] = await tx
		.select({ ownerRevision: t.ownerRevision })
		.from(t)
		.where(
			and(
				eq(t.ownerId, id),
				eq(t.component, value.component),
				eq(t.componentKey, value.componentKey),
				gt(t.componentSequence, history.componentSequence),
			),
		)
		.orderBy(t.componentSequence)
		.limit(1);
	if (next?.ownerRevision === history.ownerRevision)
		throw new TypeError("Intermediate reorder positions cannot be restored independently");
	return mutateMusicComponents(tx, ref, actor, value.expectedRevision, [
		{
			action: "restore",
			component: value.component,
			componentKey: value.componentKey,
			expectedRevisionId: value.expectedHeadId,
			historyId: value.historyId,
		},
	]);
}

/** @alpha Live structure pages use the native primary key, excluding removed history without scanning it. */
export async function pageMusicStructure(
	tx: DatabaseTransaction,
	id: string,
	actor: string,
	input: z.input<typeof MusicStructureQuerySchema>,
) {
	const query = MusicStructureQuerySchema.parse(input),
		ref = reference(id);
	const identity = await loadCatalogIdentity(tx, ref, actor, true);
	const owner = musicComponentOwner(query.component),
		keys = MusicComponentKeys[query.component];
	if (identity.shape !== owner.shape)
		throw new TypeError("Component belongs to another music object shape");
	const columns = keys.map((key) => sql`native.${sql.identifier(key)}`);
	let after = sql`true`;
	if (query.afterKey) {
		const parts = query.afterKey.split("/");
		if (parts.length !== keys.length) throw new TypeError("Invalid music structure cursor");
		const values = parts.map((part, index) => {
			const value = part.replaceAll("~1", "/").replaceAll("~0", "~");
			if (value.replaceAll("~", "~0").replaceAll("/", "~1") !== part)
				throw new TypeError("Invalid music structure cursor escaping");
			const key = keys[index];
			return key === "id" || key?.endsWith("_id")
				? sql`${z.uuid().parse(value)}::uuid`
				: sql`${value}::text`;
		});
		after = sql`(${sql.join(columns, sql`, `)}) > (${sql.join(values, sql`, `)})`;
	}
	const result = await tx.execute(
		sql`select to_jsonb(native) as value from ${sql.identifier(query.component)} native where native.${sql.identifier(owner.column)}=${id}::uuid and ${after} order by ${sql.join(columns, sql`, `)} limit ${query.limit + 1}`,
	);
	const rows = result.rows.map((row) => MusicComponentSchemas[query.component].parse(row.value));
	const current = await heads(
		tx,
		id,
		query.component,
		rows.map((row) => musicComponentKey(query.component, row)),
	);
	const page = catalogWirePage(
		rows.map((value) => {
			const key = musicComponentKey(query.component, value),
				headId = current.get(key);
			if (!headId) throw new Error("Live music component has no native history head");
			return { id: key, value: { component: query.component, componentKey: key, headId, value } };
		}),
		query.limit,
	);
	return MusicStructurePageSchema.parse({ ...page, revision: identity.revision });
}
