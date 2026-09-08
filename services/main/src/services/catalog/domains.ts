import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import {
	publishingPublication,
	publishingReleaseEvent,
	publishingTextVersion,
	publishingWork,
} from "../database/schema/catalog-publishing";
import {
	musicArtistCredit,
	musicArtistCreditName,
	musicMedium,
	musicRecording,
	musicRelease,
	musicReleaseEvent,
	musicReleaseGroup,
	musicTrackOccurrence,
	musicWork,
} from "../database/schema/catalog-music";
import { programEpisode, programWork } from "../database/schema/catalog-program";
import {
	softwareContent,
	softwareRelease,
	softwareReleaseContent,
	softwareVisualNovel,
} from "../database/schema/catalog-software";
import { referenceArea } from "../database/schema/catalog-reference";
import { musicIdentity } from "../database/schema/catalog-identity";
import { readCatalogAuthorityScope, catalogIdentityReadPredicate } from "../participation/policy";
import { requireMusicCreditAccess, musicCreditReferenceHeads } from "./music-credit-access";
import {
	CatalogPartialDateSchema,
	CatalogReferenceSchema,
	type CatalogReference,
} from "./contracts";
import {
	CatalogAccessDenied,
	addCatalogName,
	assertReadableTargets,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

const exactInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nameSchema = z.strictObject({
	languageTag: z.string().nullable(),
	value: z.string().min(1).max(131_072),
});
type NativeName = z.infer<typeof nameSchema>;

async function requireShape(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	owner: CatalogReference["owner"],
	shape: string,
	write = false,
) {
	const ref = CatalogReferenceSchema.parse({ owner: reference.owner, id: reference.id });
	if (ref.owner !== owner) throw new TypeError(`Expected ${owner} storage owner`);
	const identity = await loadCatalogIdentity(tx, ref, actor, write);
	if (identity.shape !== shape) throw new TypeError(`Expected ${shape} identity`);
	return identity;
}

async function nameIdentity(
	tx: DatabaseTransaction,
	identity: CatalogReference & { revision: number },
	actor: string,
	name: NativeName,
) {
	const value = nameSchema.parse(name);
	return {
		...identity,
		revision: (
			await addCatalogName(tx, identity, actor, identity.revision, { ...value, kind: "primary" })
		).revision,
	};
}

/** A source-free publication does not manufacture a Work or text-version parent. */
export async function createPublication(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly pageCount?: number | null;
		readonly paginationText?: string | null;
	},
) {
	const value = z
		.strictObject({
			name: nameSchema,
			pageCount: exactInteger.nullable().optional(),
			paginationText: z.string().nullable().optional(),
		})
		.parse(input);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "publishing", shape: "publication" },
		actor,
	);
	await tx.insert(publishingPublication).values({
		id: identity.id,
		pageCount: value.pageCount ?? null,
		paginationText: value.paginationText ?? null,
	});
	return nameIdentity(tx, identity, actor, value.name);
}

export async function createPublishingWork(
	tx: DatabaseTransaction,
	actor: string,
	name: NativeName,
) {
	const identity = await createCatalogIdentity(tx, { owner: "publishing", shape: "work" }, actor);
	await tx.insert(publishingWork).values({ id: identity.id });
	return nameIdentity(tx, identity, actor, name);
}

export async function createTextVersion(
	tx: DatabaseTransaction,
	actor: string,
	input: { readonly name: NativeName; readonly languageTag: string | null },
) {
	const languageTag =
		input.languageTag === null ? null : canonicalizeContentLanguageTag(input.languageTag);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "publishing", shape: "text_version" },
		actor,
	);
	await tx.insert(publishingTextVersion).values({ id: identity.id, languageTag });
	return nameIdentity(tx, identity, actor, input.name);
}

export type MusicCreditMemberInput = {
	readonly artist?: CatalogReference;
	readonly creditedName: string;
	readonly joinPhrase: string;
	readonly sourcePosition?: number | null;
};

async function requireMusicCreditDraftContext(
	tx: DatabaseTransaction,
	actor: string,
	credit: typeof musicArtistCredit.$inferSelect,
) {
	if (credit.createdForMusicId) {
		await loadCatalogIdentity(
			tx,
			{ owner: "music", id: credit.createdForMusicId },
			actor,
			true,
			"share",
		);
		return;
	}
	const scope = await readCatalogAuthorityScope(tx, actor);
	if (scope.creatorAuthUserId !== actor || credit.createdByAuthUserId !== actor)
		throw new CatalogAccessDenied("Artist credit has no authorized creation context");
}

export async function beginMusicCredit(
	tx: DatabaseTransaction,
	actor: string,
	renderedName: string | null = null,
	createdFor?: CatalogReference,
) {
	z.uuid().parse(actor);
	z.string().max(512_000).nullable().parse(renderedName);
	if (createdFor) {
		if (createdFor.owner !== "music")
			throw new TypeError("Credit creation context must be a music identity");
		await loadCatalogIdentity(tx, createdFor, actor, true, "share");
	} else if ((await readCatalogAuthorityScope(tx, actor)).creatorAuthUserId !== actor)
		throw new CatalogAccessDenied("Scoped credit creation requires an authorized music context");
	const [credit] = await tx
		.insert(musicArtistCredit)
		.values({ renderedName, createdByAuthUserId: actor, createdForMusicId: createdFor?.id ?? null })
		.returning({ id: musicArtistCredit.id });
	if (!credit) throw new Error("Artist credit insertion returned no row");
	return credit.id;
}

export async function appendMusicCreditMembers(
	tx: DatabaseTransaction,
	actor: string,
	creditId: string,
	expectedCount: number,
	input: readonly MusicCreditMemberInput[],
) {
	z.uuid().parse(actor);
	z.uuid().parse(creditId);
	exactInteger.parse(expectedCount);
	const members = z
		.array(
			z.strictObject({
				artist: CatalogReferenceSchema.optional(),
				creditedName: z.string().min(1).max(131_072),
				joinPhrase: z.string().max(4096),
				sourcePosition: exactInteger.nullable().optional(),
			}),
		)
		.min(1)
		.max(128)
		.parse(
			input.map((member) => ({
				...member,
				artist: member.artist ? { owner: member.artist.owner, id: member.artist.id } : undefined,
			})),
		);
	if (Buffer.byteLength(JSON.stringify(members), "utf8") > 512_000)
		throw new RangeError("Artist credit batch exceeds its byte budget");
	const artists = members.flatMap((member) => (member.artist ? [member.artist] : []));
	if (artists.some((artist) => artist.owner !== "entity"))
		throw new TypeError("Artist credit target must be an Entity");
	await assertReadableTargets(tx, artists, actor);
	const [credit] = await tx
		.select()
		.from(musicArtistCredit)
		.where(eq(musicArtistCredit.id, creditId))
		.limit(1)
		.for("update");
	if (!credit) throw new CatalogAccessDenied("Artist credit is not editable by this actor");
	await requireMusicCreditDraftContext(tx, actor, credit);
	if (
		credit.sealedAt ||
		credit.retiredAt ||
		credit.memberCount !== expectedCount ||
		credit.lastPosition !== expectedCount - 1
	)
		throw new Error("Artist credit append prefix changed or is sealed");
	await tx.insert(musicArtistCreditName).values(
		members.map((member, offset) => ({
			creditId,
			position: expectedCount + offset,
			artistId: member.artist?.id ?? null,
			creditedName: member.creditedName,
			joinPhrase: member.joinPhrase,
			sourcePosition: member.sourcePosition ?? null,
		})),
	);
	return { memberCount: expectedCount + members.length };
}

export async function sealMusicCredit(
	tx: DatabaseTransaction,
	actor: string,
	creditId: string,
	expectedCount: number,
) {
	z.uuid().parse(actor);
	z.uuid().parse(creditId);
	exactInteger.min(1).parse(expectedCount);
	const [credit] = await tx
		.select()
		.from(musicArtistCredit)
		.where(eq(musicArtistCredit.id, creditId))
		.limit(1)
		.for("update");
	if (!credit) throw new CatalogAccessDenied("Artist credit is not editable by this actor");
	await requireMusicCreditDraftContext(tx, actor, credit);
	if (
		credit.sealedAt ||
		credit.retiredAt ||
		credit.memberCount !== expectedCount ||
		credit.lastPosition !== expectedCount - 1
	)
		throw new Error("Artist credit prefix is not ready to seal");
	await tx
		.update(musicArtistCredit)
		.set({ sealedAt: sql`current_timestamp` })
		.where(eq(musicArtistCredit.id, creditId));
}

/** Convenience for a single admitted batch; large groups use begin/append/seal. */
export async function createMusicCredit(
	tx: DatabaseTransaction,
	actor: string,
	input: readonly MusicCreditMemberInput[],
) {
	if (input.length < 1 || input.length > 128)
		throw new RangeError("Use staged artist credit commands for multiple batches");
	const id = await beginMusicCredit(
		tx,
		actor,
		input.map((member) => member.creditedName + member.joinPhrase).join(""),
	);
	await appendMusicCreditMembers(tx, actor, id, 0, input);
	await sealMusicCredit(tx, actor, id, input.length);
	return id;
}

async function requireCredit(
	tx: DatabaseTransaction,
	creditId: string | null | undefined,
	actor: string,
	context?: CatalogReference,
) {
	if (!creditId) return;
	await requireMusicCreditAccess(
		tx,
		actor,
		[creditId],
		context
			? {
					reference: context,
					write: true,
					historyIds: await musicCreditReferenceHeads(tx, context.id, "music_release", [
						context.id,
					]),
				}
			: undefined,
	);
}

export async function createMusicalWork(tx: DatabaseTransaction, actor: string, name: NativeName) {
	const identity = await createCatalogIdentity(tx, { owner: "music", shape: "work" }, actor);
	await tx.insert(musicWork).values({ id: identity.id });
	return nameIdentity(tx, identity, actor, name);
}

export async function createRecording(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly artistCreditId?: string | null;
		readonly lengthMilliseconds?: number | null;
		readonly video?: boolean | null;
	},
) {
	const value = z
		.strictObject({
			name: nameSchema,
			artistCreditId: z.uuid().nullable().optional(),
			lengthMilliseconds: exactInteger.nullable().optional(),
			video: z.boolean().nullable().optional(),
		})
		.parse(input);
	await requireCredit(tx, value.artistCreditId, actor);
	const identity = await createCatalogIdentity(tx, { owner: "music", shape: "recording" }, actor);
	await tx.insert(musicRecording).values({
		id: identity.id,
		artistCreditId: value.artistCreditId ?? null,
		lengthMilliseconds: value.lengthMilliseconds ?? null,
		video: value.video ?? null,
	});
	return nameIdentity(tx, identity, actor, value.name);
}

export async function createReleaseGroup(tx: DatabaseTransaction, actor: string, name: NativeName) {
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "music", shape: "release_group" },
		actor,
	);
	await tx.insert(musicReleaseGroup).values({ id: identity.id });
	return nameIdentity(tx, identity, actor, name);
}

export async function createMusicRelease(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly releaseGroup?: CatalogReference;
		readonly artistCreditId?: string | null;
		readonly languageTag?: string | null;
		readonly scriptCode?: string | null;
	},
) {
	if (input.releaseGroup)
		await requireShape(tx, input.releaseGroup, actor, "music", "release_group");
	await requireCredit(tx, input.artistCreditId, actor);
	const languageTag = input.languageTag ? canonicalizeContentLanguageTag(input.languageTag) : null;
	const scriptCode = z
		.string()
		.regex(/^[A-Z][a-z]{3}$/u)
		.nullable()
		.parse(input.scriptCode ?? null);
	const identity = await createCatalogIdentity(tx, { owner: "music", shape: "release" }, actor);
	await tx.insert(musicRelease).values({
		id: identity.id,
		releaseGroupId: input.releaseGroup?.id ?? null,
		artistCreditId: input.artistCreditId ?? null,
		languageTag,
		scriptCode,
	});
	return nameIdentity(tx, identity, actor, input.name);
}

export async function addMusicMedium(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		readonly position: number;
		readonly name?: string | null;
		readonly sourceTrackCount?: number | null;
	},
) {
	await requireShape(tx, release, actor, "music", "release", true);
	const value = z
		.strictObject({
			position: exactInteger,
			name: z.string().nullable().optional(),
			sourceTrackCount: exactInteger.nullable().optional(),
		})
		.parse(input);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.add",
	);
	const [medium] = await tx
		.insert(musicMedium)
		.values({ releaseId: release.id, ...value })
		.returning({ id: musicMedium.id });
	if (!medium) throw new Error("Medium insertion returned no row");
	return { id: medium.id, revision };
}

export async function addMusicTrack(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		readonly mediumId: string;
		readonly recording?: CatalogReference;
		readonly position: number;
		readonly number: string;
		readonly name?: string | null;
		readonly artistCreditId?: string | null;
		readonly lengthMilliseconds?: number | null;
		readonly isDataTrack?: boolean | null;
	},
) {
	await requireShape(tx, release, actor, "music", "release", true);
	if (input.recording) await requireShape(tx, input.recording, actor, "music", "recording");
	await requireCredit(tx, input.artistCreditId, actor, release);
	const value = z
		.strictObject({
			mediumId: z.uuid(),
			position: exactInteger,
			number: z.string(),
			name: z.string().nullable().optional(),
			artistCreditId: z.uuid().nullable().optional(),
			lengthMilliseconds: exactInteger.nullable().optional(),
			isDataTrack: z.boolean().nullable().optional(),
		})
		.parse({
			mediumId: input.mediumId,
			position: input.position,
			number: input.number,
			name: input.name,
			artistCreditId: input.artistCreditId,
			lengthMilliseconds: input.lengthMilliseconds,
			isDataTrack: input.isDataTrack,
		});
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.track.add",
	);
	const [track] = await tx
		.insert(musicTrackOccurrence)
		.values({ releaseId: release.id, ...value, recordingId: input.recording?.id ?? null })
		.returning({ id: musicTrackOccurrence.id });
	if (!track) throw new Error("Track insertion returned no row");
	return { id: track.id, revision };
}

export async function readMusicTracks(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	mediumId: string,
	afterPosition = -1,
	limit = 50,
) {
	await requireShape(tx, release, actor, "music", "release");
	z.uuid().parse(mediumId);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(100).parse(limit);
	const track = musicTrackOccurrence;
	const scope = await readCatalogAuthorityScope(tx, actor);
	const recordingVisible = sql`exists (select 1 from ${musicIdentity} where ${musicIdentity.id} = ${track.recordingId} and ${catalogIdentityReadPredicate(scope, "music", musicIdentity)})`;
	// This row is the actual authorized native referencer; the credit fragment is not an independent catalog identity.
	const creditVisible = sql`exists (select 1 from ${musicArtistCredit} where ${musicArtistCredit.id} = ${track.artistCreditId} and ${musicArtistCredit.sealedAt} is not null and ${musicArtistCredit.retiredAt} is null)`;
	return tx
		.select({
			releaseId: track.releaseId,
			mediumId: track.mediumId,
			id: track.id,
			position: track.position,
			number: track.number,
			name: track.name,
			lengthMilliseconds: track.lengthMilliseconds,
			isDataTrack: track.isDataTrack,
			recordingId: sql<
				string | null
			>`case when ${recordingVisible} then ${track.recordingId} else null end`,
			artistCreditId: sql<
				string | null
			>`case when ${creditVisible} then ${track.artistCreditId} else null end`,
		})
		.from(track)
		.where(
			and(
				eq(track.releaseId, release.id),
				sql`exists (select 1 from ${musicIdentity} where ${musicIdentity.id}=${track.releaseId} and ${catalogIdentityReadPredicate(scope, "music", musicIdentity)})`,
				eq(track.mediumId, mediumId),
				gt(track.position, afterPosition),
			),
		)
		.orderBy(track.position)
		.limit(limit);
}

export async function addReleaseDate(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	input: {
		readonly date: z.input<typeof CatalogPartialDateSchema>;
		readonly dateText?: string | null;
		readonly area?: CatalogReference;
	},
) {
	const date = CatalogPartialDateSchema.parse(input.date);
	if (input.area) {
		await requireShape(tx, input.area, actor, "reference", "area");
	}
	const values = {
		dateYear: date.year,
		dateMonth: date.month,
		dateDay: date.day,
		dateText: input.dateText ?? null,
		areaId: input.area?.id ?? null,
	};
	if (release.owner === "music") {
		await requireShape(tx, release, actor, "music", "release", true);
		const revision = await recordCatalogChange(
			tx,
			release,
			actor,
			expectedVersion,
			"music.release.date.add",
		);
		await tx.insert(musicReleaseEvent).values({ releaseId: release.id, ...values });
		return { revision };
	}
	await requireShape(tx, release, actor, "publishing", "publication", true);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"publishing.release.date.add",
	);
	await tx.insert(publishingReleaseEvent).values({ publicationId: release.id, ...values });
	return { revision };
}

export async function createArea(tx: DatabaseTransaction, actor: string, name: NativeName) {
	const identity = await createCatalogIdentity(tx, { owner: "reference", shape: "area" }, actor);
	await tx.insert(referenceArea).values({ id: identity.id });
	return nameIdentity(tx, identity, actor, name);
}

export async function createProgram(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly mainEpisodes?: number | null;
		readonly totalEpisodes?: number | null;
	},
) {
	const value = z
		.strictObject({
			name: nameSchema,
			mainEpisodes: exactInteger.nullable().optional(),
			totalEpisodes: exactInteger.nullable().optional(),
		})
		.parse(input);
	const identity = await createCatalogIdentity(tx, { owner: "program", shape: "program" }, actor);
	await tx.insert(programWork).values({
		id: identity.id,
		declaredMainEpisodeCount: value.mainEpisodes ?? null,
		declaredTotalEpisodeCount: value.totalEpisodes ?? null,
	});
	return nameIdentity(tx, identity, actor, value.name);
}

export async function createEpisode(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly program?: CatalogReference;
		readonly sort?: number | null;
		readonly episodeNumber?: number | null;
		readonly durationText?: string | null;
	},
) {
	if (input.program) await requireShape(tx, input.program, actor, "program", "program");
	const sort = z
		.number()
		.finite()
		.nullable()
		.parse(input.sort ?? null);
	const episode = z
		.number()
		.finite()
		.nullable()
		.parse(input.episodeNumber ?? null);
	const identity = await createCatalogIdentity(tx, { owner: "program", shape: "episode" }, actor);
	await tx.insert(programEpisode).values({
		id: identity.id,
		programId: input.program?.id ?? null,
		sortNumber: sort === null ? null : String(sort),
		episodeNumber: episode === null ? null : String(episode),
		durationText: input.durationText ?? null,
	});
	return nameIdentity(tx, identity, actor, input.name);
}

export async function createVisualNovel(tx: DatabaseTransaction, actor: string, name: NativeName) {
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "content" }, actor);
	await tx.insert(softwareContent).values({ id: identity.id });
	await tx.insert(softwareVisualNovel).values({ id: identity.id });
	return nameIdentity(tx, identity, actor, name);
}

export async function createSoftwareRelease(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly name: NativeName;
		readonly content?: CatalogReference;
		readonly isPatch?: boolean;
	},
) {
	if (input.content) await requireShape(tx, input.content, actor, "software", "content");
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "release" }, actor);
	await tx.insert(softwareRelease).values({ id: identity.id, isPatch: input.isPatch ?? null });
	if (input.content)
		await tx.insert(softwareReleaseContent).values({
			releaseId: identity.id,
			contentId: input.content.id,
		});
	return nameIdentity(tx, identity, actor, input.name);
}
