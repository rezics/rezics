import { and, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	programEpisode,
	programEpisodeOccurrence,
	programSeason,
	programVersion,
	programWork,
} from "../database/schema/catalog-program";
import { programIdentity } from "../database/schema/catalog-identity";
import { isFractionalPosition } from "../ordering/position";
import { CatalogPartialDateSchema, type CatalogReference } from "./contracts";
import {
	addCatalogName,
	assertReadableTargets,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableId = z.uuid().nullable().default(null);
const name = z.strictObject({
	languageTag: z.string().nullable(),
	value: z.string().min(1).max(131_072),
});
const programFields = z.strictObject({
	typeRevisionId: nullableId,
	declaredMainEpisodeCount: integer.nullable().default(null),
	declaredTotalEpisodeCount: integer.nullable().default(null),
});
const seasonFields = z.strictObject({
	programId: nullableId,
	number: z.string().max(4096).nullable().default(null),
});
const versionFields = z.strictObject({
	programId: nullableId,
	versionTypeRevisionId: nullableId,
	lengthMilliseconds: integer.nullable().default(null),
});
const episodeFields = z
	.strictObject({
		programId: nullableId,
		seasonId: nullableId,
		typeRevisionId: nullableId,
		sortNumber: z.number().finite().nullable().default(null),
		episodeNumber: z.number().finite().nullable().default(null),
		discNumber: z.number().int().min(0).max(2_147_483_647).nullable().default(null),
		durationText: z.string().max(4096).nullable().default(null),
		lengthMilliseconds: integer.nullable().default(null),
		date: CatalogPartialDateSchema.default({ year: null, month: null, day: null }),
		dateText: z.string().max(4096).nullable().default(null),
	})
	.refine((value) => value.seasonId === null || value.programId !== null, {
		message: "An episode assigned to a season requires the season's program",
	});

/** Native program structures, independent of source subject classifications. @internal */
export const ProgramStructureSchema = z.discriminatedUnion("shape", [
	z.strictObject({ shape: z.literal("program"), fields: programFields }),
	z.strictObject({ shape: z.literal("season"), fields: seasonFields }),
	z.strictObject({ shape: z.literal("program_version"), fields: versionFields }),
	z.strictObject({ shape: z.literal("episode"), fields: episodeFields }),
]);

async function requireProgram(
	tx: DatabaseTransaction,
	id: string,
	actor: string | null,
	shape: string,
) {
	const identity = await loadCatalogIdentity(tx, { owner: "program", id }, actor, false);
	if (identity.shape !== shape) throw new TypeError(`Expected program ${shape}`);
}

async function validateParents(
	tx: DatabaseTransaction,
	actor: string,
	value: z.output<typeof ProgramStructureSchema>,
) {
	if (value.shape === "program") return;
	if (value.fields.programId) await requireProgram(tx, value.fields.programId, actor, "program");
	if (value.shape === "episode" && value.fields.seasonId) {
		await requireProgram(tx, value.fields.seasonId, actor, "season");
		const [season] = await tx
			.select()
			.from(programSeason)
			.where(eq(programSeason.id, value.fields.seasonId))
			.limit(1);
		if (!season || season.programId !== value.fields.programId)
			throw new TypeError("Episode season belongs to another program");
	}
}

function episodeColumns(fields: z.output<typeof episodeFields>) {
	const { date, sortNumber, episodeNumber, ...rest } = fields;
	return {
		...rest,
		sortNumber: sortNumber === null ? null : String(sortNumber),
		episodeNumber: episodeNumber === null ? null : String(episodeNumber),
		dateYear: date.year,
		dateMonth: date.month,
		dateDay: date.day,
	};
}

/** Creates one independently addressable program, season, version, or episode. @internal */
export async function createProgramStructure(
	tx: DatabaseTransaction,
	actor: string,
	input: z.input<typeof ProgramStructureSchema>,
	title: z.input<typeof name>,
) {
	const value = ProgramStructureSchema.parse(input);
	const titleValue = name.parse(title);
	await validateParents(tx, actor, value);
	const identity = await createCatalogIdentity(tx, { owner: "program", shape: value.shape }, actor);
	switch (value.shape) {
		case "program":
			await tx.insert(programWork).values({ id: identity.id, ...value.fields });
			break;
		case "season":
			await tx.insert(programSeason).values({ id: identity.id, ...value.fields });
			break;
		case "program_version":
			await tx.insert(programVersion).values({ id: identity.id, ...value.fields });
			break;
		case "episode":
			await tx.insert(programEpisode).values({ id: identity.id, ...episodeColumns(value.fields) });
			break;
	}
	const named = await addCatalogName(tx, identity, actor, identity.revision, {
		...titleValue,
		kind: "primary",
	});
	return { ...identity, revision: named.revision };
}

/** Replaces explicit native fields under optimistic concurrency; source snapshots stay immutable. @internal */
export async function updateProgramStructure(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof ProgramStructureSchema>,
) {
	if (reference.owner !== "program") throw new TypeError("Expected program owner");
	const value = ProgramStructureSchema.parse(input);
	await requireProgram(tx, reference.id, actor, value.shape);
	await validateParents(tx, actor, value);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"program.structure.replace",
	);
	switch (value.shape) {
		case "program":
			await tx
				.insert(programWork)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: programWork.id, set: value.fields });
			break;
		case "season":
			await tx
				.insert(programSeason)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: programSeason.id, set: value.fields });
			break;
		case "program_version":
			await tx
				.insert(programVersion)
				.values({ id: reference.id, ...value.fields })
				.onConflictDoUpdate({ target: programVersion.id, set: value.fields });
			break;
		case "episode":
			await tx
				.insert(programEpisode)
				.values({ id: reference.id, ...episodeColumns(value.fields) })
				.onConflictDoUpdate({ target: programEpisode.id, set: episodeColumns(value.fields) });
			break;
	}
	return { revision };
}

/** Single object export. Referenced private objects must be readable before returning their IDs. @internal */
export async function readProgramStructure(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
) {
	if (reference.owner !== "program") throw new TypeError("Expected program owner");
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	const table =
		identity.shape === "program"
			? programWork
			: identity.shape === "season"
				? programSeason
				: identity.shape === "program_version"
					? programVersion
					: identity.shape === "episode"
						? programEpisode
						: null;
	if (!table) throw new TypeError("Identity has no native program structure");
	const [record] = await tx.select().from(table).where(eq(table.id, reference.id)).limit(1);
	if (!record) throw new Error("Program structural row is missing");
	const targets: CatalogReference[] = [];
	if ("programId" in record && record.programId)
		targets.push({ owner: "program", id: record.programId });
	if ("seasonId" in record && record.seasonId)
		targets.push({ owner: "program", id: record.seasonId });
	await assertReadableTargets(tx, targets, actor);
	return { identity, record };
}

const occurrence = z.strictObject({
	id: z.uuid().optional(),
	episodeId: z.uuid(),
	position: z.string().refine(isFractionalPosition),
	sourceNumber: z.string().max(4096).nullable().default(null),
});

/** The same episode may occur in multiple versions without duplicating its identity. @internal */
export async function putProgramOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof occurrence>,
) {
	const value = occurrence.parse(input);
	if (reference.owner !== "program") throw new TypeError("Expected program owner");
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (!["program", "season", "program_version"].includes(identity.shape))
		throw new TypeError("Episodes cannot contain occurrences");
	await requireProgram(tx, value.episodeId, actor, "episode");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"program.occurrence.put",
	);
	const [row] = await tx
		.insert(programEpisodeOccurrence)
		.values({ ...value, ownerId: reference.id, ownerShape: identity.shape })
		.onConflictDoUpdate({
			target: [programEpisodeOccurrence.ownerId, programEpisodeOccurrence.id],
			set: {
				episodeId: value.episodeId,
				position: value.position,
				sourceNumber: value.sourceNumber,
			},
		})
		.returning();
	if (!row) throw new Error("Occurrence insertion returned no row");
	return { id: row.id, revision };
}

/** Removes only one placement; the episode identity and other versions remain. @internal */
export async function removeProgramOccurrence(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	id: string,
) {
	z.uuid().parse(id);
	if (reference.owner !== "program") throw new TypeError("Expected program owner");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"program.occurrence.remove",
	);
	await tx
		.delete(programEpisodeOccurrence)
		.where(
			and(eq(programEpisodeOccurrence.ownerId, reference.id), eq(programEpisodeOccurrence.id, id)),
		);
	return { revision };
}

/** Stable bounded keyset export, including repeated episode appearances. @internal */
export async function listProgramOccurrences(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: { after?: { position: string; id: string }; limit?: number } = {},
) {
	if (reference.owner !== "program") throw new TypeError("Expected program owner");
	await loadCatalogIdentity(tx, reference, actor, false);
	const page = z
		.strictObject({
			after: z
				.strictObject({ position: z.string().refine(isFractionalPosition), id: z.uuid() })
				.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	const row = programEpisodeOccurrence;
	const visible = sql`exists (select 1 from ${programIdentity} where ${programIdentity.id} = ${row.episodeId} and ${programIdentity.deletedAt} is null and ((${programIdentity.createdByAuthUserId} = ${actor}::uuid) is true or (${programIdentity.visibility} in ('public','unlisted') and ${programIdentity.status} = 'published' and ${programIdentity.moderationStatus} = 'approved')))`;
	const rows = await tx
		.select({
			id: row.id,
			ownerId: row.ownerId,
			ownerShape: row.ownerShape,
			episodeId: row.episodeId,
			position: row.position,
			sourceNumber: row.sourceNumber,
			readable: sql<boolean>`${visible}`,
		})
		.from(row)
		.where(
			and(
				eq(row.ownerId, reference.id),
				page.after
					? or(
							gt(row.position, page.after.position),
							and(eq(row.position, page.after.position), gt(row.id, page.after.id)),
						)
					: undefined,
			),
		)
		.orderBy(row.position, row.id)
		.limit(page.limit);
	const last = rows.at(-1);
	return {
		items: rows.filter((row) => row.readable).map(({ readable: _readable, ...item }) => item),
		nextCursor:
			rows.length === page.limit && last ? { position: last.position, id: last.id } : null,
	};
}
