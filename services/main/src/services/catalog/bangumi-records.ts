import { z } from "zod";
import { BangumiWikiEntrySchema, bangumiDate } from "./bangumi";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const integer = z.number().int().min(-2_147_483_648).max(2_147_483_647);
const flag = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const subjectType = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]);
const images = z.strictObject({
	small: z.string(),
	grid: z.string(),
	large: z.string(),
	medium: z.string(),
});
const profile = {
	id,
	name: z.string(),
	type: integer,
	summary: z.string(),
	images: images.nullable(),
	infobox: z.array(BangumiWikiEntrySchema).nullable(),
	locked: z.boolean(),
	stat: z.strictObject({ comments: count, collects: count }),
	gender: z.string().nullable().optional(),
	blood_type: integer.nullable().optional(),
	birth_year: integer.nullable().optional(),
	birth_mon: integer.nullable().optional(),
	birth_day: integer.nullable().optional(),
	nsfw: z.boolean().optional(),
};

/** Public curation attribution is catalog metadata; it does not create an Auth user. @internal */
export const BangumiIndexSchema = z.strictObject({
	id,
	title: z.string(),
	desc: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
	creator: z.strictObject({ username: z.string(), nickname: z.string() }),
	total: count,
	stat: z.strictObject({ comments: count, collects: count }),
	nsfw: z.boolean(),
	ban: z.boolean(),
});
export const BangumiIndexSubjectPageSchema = z.strictObject({
	data: z
		.array(
			z.strictObject({
				id,
				type: subjectType,
				name: z.string(),
				name_cn: z.string().optional(),
				date: z.string(),
				images: images.extend({ common: z.string() }),
				infobox: z.array(BangumiWikiEntrySchema),
				comment: z.string(),
				added_at: z.string(),
			}),
		)
		.max(50),
	total: count,
	limit: count.max(50),
	offset: count,
});

/** Revision APIs can return null/empty payloads; those responses are not complete wiki revisions. @internal */
export const BangumiRevisionSchema = z.strictObject({
	id,
	type: integer,
	created_at: z.string(),
	creator: z.strictObject({ username: z.string(), nickname: z.string() }),
	summary: z.string(),
	data: z.record(z.string(), z.unknown()).nullable(),
});

export const BangumiRevisionPageSchema = z.strictObject({
	data: z.array(BangumiRevisionSchema).max(50),
	total: count,
	limit: count.max(50),
	offset: count,
});

/** A global revision ID alone does not establish which native subject it describes. @internal */
export function validateBangumiRevisionContext(input: {
	key: { objectType: string; externalId: string };
	page: unknown;
	entryIndex: number;
	objectType: "subject" | "person" | "character";
	externalId: number;
	revisionId: number;
}) {
	const page = BangumiRevisionPageSchema.parse(input.page);
	z.number().int().min(0).max(49).parse(input.entryIndex);
	id.parse(input.externalId);
	id.parse(input.revisionId);
	if (
		input.key.objectType !== `${input.objectType}_revisions` ||
		input.key.externalId !== `${input.externalId}:${page.offset}` ||
		page.data[input.entryIndex]?.id !== input.revisionId
	)
		throw new TypeError(
			"Revision membership evidence does not identify the selected source entity and revision",
		);
	return `/data/${input.entryIndex}/id`;
}

/** Public relationship endpoint records preserve contextual actors separately from character identity. @internal */
export const BangumiApiRelationSchemas = {
	subject_persons: z.strictObject({
		id,
		type: integer,
		name: z.string(),
		images: images.nullable(),
		relation: z.string(),
		career: z.array(z.string()),
		eps: z.string().optional(),
	}),
	subject_subjects: z.strictObject({
		id,
		type: subjectType,
		name: z.string(),
		name_cn: z.string(),
		images: images.extend({ common: z.string() }).nullable(),
		relation: z.string(),
	}),
	subject_characters: z.strictObject({
		id,
		type: integer,
		name: z.string(),
		images: images.nullable(),
		summary: z.string().optional(),
		relation: z.string(),
		actors: z.array(
			z.strictObject({
				id,
				type: integer,
				name: z.string(),
				images: images.nullable(),
				short_summary: z.string().optional(),
				career: z.array(z.string()),
				locked: z.boolean().optional(),
			}),
		),
	}),
	person_subjects: z.strictObject({
		id,
		type: subjectType,
		name: z.string(),
		name_cn: z.string(),
		image: z.string(),
		staff: z.string(),
		eps: z.string().optional(),
	}),
	character_subjects: z.strictObject({
		id,
		type: subjectType,
		name: z.string(),
		name_cn: z.string(),
		image: z.string(),
		staff: z.string(),
	}),
	person_characters: z.strictObject({
		id,
		type: integer,
		name: z.string(),
		images: images.nullable(),
		subject_id: id,
		subject_type: subjectType,
		subject_name: z.string(),
		subject_name_cn: z.string(),
		staff: z.string(),
	}),
	character_persons: z.strictObject({
		id,
		type: integer,
		name: z.string(),
		images: images.nullable(),
		subject_id: id,
		subject_type: subjectType,
		subject_name: z.string(),
		subject_name_cn: z.string(),
		staff: z.string(),
	}),
};

/** Selects a literal revision member; dictionary keys are revision IDs, never inferred entity IDs. @internal */
export function selectBangumiRevisionWiki(input: unknown, revisionItemId?: string) {
	const revision = BangumiRevisionSchema.parse(input);
	if (!revision.data) return { status: "unavailable" as const, revision };
	if (typeof revision.data.field_infobox === "string")
		return {
			status: "available" as const,
			revision,
			path: "/data/field_infobox",
			wiki: parseBangumiWiki(revision.data.field_infobox),
		};
	if (revisionItemId === undefined) return { status: "selection_required" as const, revision };
	if (!/^\d+$/u.test(revisionItemId))
		throw new TypeError("Revision member must be an exact numeric dictionary key");
	const member = z.object({ infobox: z.string() }).safeParse(revision.data[revisionItemId]);
	if (!member.success) return { status: "unavailable" as const, revision };
	return {
		status: "available" as const,
		revision,
		path: `/data/${revisionItemId}/infobox`,
		wiki: parseBangumiWiki(member.data.infobox),
	};
}

/** Public endpoint declarations plus explicit, independently observed wire corrections. @internal */
export const BangumiPersonSchema = z.strictObject({
	...profile,
	career: z.array(z.string()),
	img: z.string().optional(),
	last_modified: z.string().optional(),
});
export const BangumiCharacterSchema = z.strictObject(profile);
export const BangumiEpisodeSchema = z.strictObject({
	id,
	subject_id: id,
	type: integer,
	name: z.string(),
	name_cn: z.string(),
	sort: z.number().finite(),
	ep: z.number().finite().optional(),
	airdate: z.string(),
	comment: count,
	duration: z.string(),
	desc: z.string(),
	disc: integer,
	duration_seconds: count.optional(),
});

/** Archive rows differ deliberately from API responses; no invented default fields. @internal */
export const BangumiArchiveEpisodeSchema = z.strictObject({
	id,
	subject_id: id,
	type: integer,
	name: z.string(),
	name_cn: z.string(),
	sort: z.number().finite(),
	airdate: z.string(),
	duration: z.string(),
	description: z.string(),
	disc: integer,
});
export const BangumiArchivePersonSchema = z.strictObject({
	id,
	name: z.string(),
	type: integer,
	career: z.array(z.string()),
	infobox: z.string(),
	summary: z.string(),
	comments: count,
	collects: count,
});
export const BangumiArchiveCharacterSchema = z.strictObject({
	id,
	name: z.string(),
	role: integer,
	infobox: z.string(),
	summary: z.string(),
	comments: count,
	collects: count,
});

/** Archive Subject wire fields, verified against the complete pinned 2026-09-01 dump. @internal */
export const BangumiArchiveSubjectSchema = z.strictObject({
	id,
	type: subjectType,
	name: z.string(),
	name_cn: z.string(),
	infobox: z.string(),
	platform: integer,
	summary: z.string(),
	nsfw: z.boolean(),
	tags: z.array(z.strictObject({ name: z.string(), count })),
	meta_tags: z.array(z.string()),
	score: z.number().finite(),
	score_details: z.partialRecord(
		z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]),
		count,
	),
	rank: count,
	date: z.string(),
	favorite: z.strictObject({
		wish: count,
		done: count,
		doing: count,
		on_hold: count,
		dropped: count,
	}),
	series: z.boolean(),
});

/** API-only episode counts/images are absent in Archive; the mapper never manufactures them. @internal */
export function planBangumiArchiveSubject(input: unknown) {
	const subject = BangumiArchiveSubjectSchema.parse(input);
	const owner =
		subject.type === 1
			? subject.series
				? "grouping"
				: "publishing"
			: subject.type === 3
				? "music"
				: subject.type === 4
					? "software"
					: "program";
	const shape =
		subject.type === 1
			? subject.series
				? "grouping"
				: "catalog_entry"
			: subject.type === 3
				? "catalog_entry"
				: subject.type === 4
					? "content"
					: "program";
	return {
		subject,
		owner,
		shape,
		names: [
			...(subject.name ? [{ languageTag: null, kind: "source-primary", value: subject.name }] : []),
			...(subject.name_cn
				? [{ languageTag: "zh", kind: "source-translated", value: subject.name_cn }]
				: []),
		],
		date: bangumiDate(subject.date),
		contentRating: subject.nsfw ? "r18" : "general",
	} as const;
}

/** Archive relation attributes remain on the relation, including contextual voice credits. @internal */
export const BangumiArchiveRelationSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("subject-relations"),
		subject_id: id,
		relation_type: integer,
		related_subject_id: id,
		order: integer,
	}),
	z.strictObject({
		kind: z.literal("subject-characters"),
		subject_id: id,
		character_id: id,
		type: integer,
		order: integer,
	}),
	z.strictObject({
		kind: z.literal("subject-persons"),
		subject_id: id,
		person_id: id,
		position: integer,
		appear_eps: z.string().optional(),
	}),
	z.strictObject({
		kind: z.literal("person-characters"),
		subject_id: id,
		person_id: id,
		character_id: id,
		type: integer,
		summary: z.string(),
	}),
	z.strictObject({
		kind: z.literal("person-relations"),
		person_type: z.enum(["prsn", "crt"]),
		person_id: count,
		related_person_id: count,
		relation_type: integer,
		spoiler: flag,
		ended: flag,
	}),
]);

/** External IDs are scoped by object type; archive rows without IDs have a deterministic tuple key. @internal */
export function bangumiRelationKey(input: z.input<typeof BangumiArchiveRelationSchema>) {
	const row = BangumiArchiveRelationSchema.parse(input);
	switch (row.kind) {
		case "subject-relations":
			return `${row.subject_id}:${row.relation_type}:${row.related_subject_id}`;
		case "subject-characters":
			return `${row.subject_id}:${row.character_id}:${row.type}`;
		case "subject-persons":
			return `${row.subject_id}:${row.person_id}:${row.position}`;
		case "person-characters":
			return `${row.subject_id}:${row.person_id}:${row.character_id}`;
		case "person-relations":
			return `${row.person_type}:${row.person_id}:${row.relation_type}:${row.related_person_id}`;
	}
}

/** Default timestamps and zero duration parser sentinels never claim precise knowledge. @internal */
export function planBangumiEpisode(input: unknown) {
	const episode = BangumiEpisodeSchema.parse(input);
	return {
		episode,
		date: bangumiDate(episode.airdate),
		lengthMilliseconds:
			episode.duration_seconds &&
			episode.duration_seconds <= Math.floor(Number.MAX_SAFE_INTEGER / 1000)
				? episode.duration_seconds * 1000
				: null,
	};
}

/** This is grain evidence, not a provider-specific native class. @internal */
export function bangumiSubjectOwner(type: z.infer<typeof subjectType>) {
	switch (type) {
		case 1:
			return "publishing";
		case 2:
		case 6:
			return "program";
		case 3:
			return "music";
		case 4:
			return "software";
	}
}

/** The wiki spec permits repeated keys and ordered lists; parsing never builds a key-value map. @internal */
export function parseBangumiWiki(text: string):
	| {
			status: "parsed";
			type: string | null;
			entries: z.infer<typeof BangumiWikiEntrySchema>[];
			raw: string;
	  }
	| { status: "unparsed"; raw: string; reason: string } {
	if (Buffer.byteLength(text, "utf8") > 8_000_000)
		throw new RangeError("Wiki exceeds source byte budget");
	if (text === "") return { status: "parsed", type: null, entries: [], raw: text };
	const lines = text.replaceAll("\r\n", "\n").split("\n");
	const first = lines[0]?.match(/^\{\{Infobox(?:\s+([a-zA-Z/]+))?\s*$/u);
	if (!first || lines.at(-1)?.trim() !== "}}")
		return { status: "unparsed", raw: text, reason: "Unrecognized wiki envelope" };
	const entries: z.infer<typeof BangumiWikiEntrySchema>[] = [];
	for (let line = 1; line < lines.length - 1; line++) {
		const current = lines[line] ?? "";
		if (!current.trim()) continue;
		const field = current.match(/^\|([^=]*)=(.*)$/u);
		if (!field) return { status: "unparsed", raw: text, reason: "Unrecognized field syntax" };
		const key = (field[1] ?? "").trim();
		const value = (field[2] ?? "").trim();
		if (value !== "{") {
			entries.push({ key, value });
			continue;
		}
		const values: { k?: string; v: string }[] = [];
		let closed = false;
		while (++line < lines.length - 1) {
			const item = (lines[line] ?? "").trim();
			if (item === "}") {
				closed = true;
				break;
			}
			if (!item) continue;
			if (!item.startsWith("[") || !item.endsWith("]"))
				return { status: "unparsed", raw: text, reason: "Unrecognized list item" };
			const content = item.slice(1, -1);
			const separator = content.indexOf("|");
			values.push(
				separator === -1
					? { v: content }
					: { k: content.slice(0, separator), v: content.slice(separator + 1) },
			);
		}
		if (!closed) return { status: "unparsed", raw: text, reason: "Unclosed list" };
		entries.push({ key, value: values });
	}
	return { status: "parsed", type: first[1] ?? null, entries, raw: text };
}
