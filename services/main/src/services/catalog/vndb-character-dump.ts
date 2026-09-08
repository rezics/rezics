import { createHash } from "node:crypto";
import { z } from "zod";
import { VndbCharacterSchema } from "./vndb-entities";
import { VndbDumpImageSchema, vndbDumpImage } from "./vndb-dump-media";
import { vndbLanguage } from "./vndb";
import type { VndbNativeNamePlan } from "./vndb-names-update";
import type { VndbSemanticPlan } from "./vndb-semantics-contracts";

const id = z.string().regex(/^c[1-9][0-9]*$/u);
const count = z.number().int().nonnegative().max(32767);
const spoil = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const text = z.string().min(1).max(131072);
const sex = z.enum(["", "m", "f", "b", "n"]);
const gender = z.enum(["", "m", "f", "o", "a"]);
export const VndbCharacterDumpSchema = z.object({
	character: z.object({
		id,
		image: z
			.string()
			.regex(/^ch[1-9][0-9]*$/u)
			.nullable(),
		bloodt: z.enum(["unknown", "a", "b", "ab", "o"]),
		cup_size: z.string(),
		sex,
		spoil_sex: sex.nullable(),
		gender: gender.nullable(),
		spoil_gender: gender.nullable(),
		main: id.nullable(),
		main_spoil: spoil,
		s_bust: count,
		s_waist: count,
		s_hip: count,
		birthday: count,
		height: count,
		weight: count.nullable(),
		age: count.nullable(),
		description: z.string().max(524288),
	}),
	names: z
		.array(z.object({ id, lang: z.string(), name: text, latin: text.nullable() }))
		.min(1)
		.max(128),
	aliases: z.array(z.object({ id, spoil, name: text, latin: text.nullable() })).max(1024),
	traits: z
		.array(z.object({ id, tid: z.string().regex(/^i[1-9][0-9]*$/u), spoil, lie: z.boolean() }))
		.max(4096),
	vns: z
		.array(
			z.object({
				id,
				vid: z.string().regex(/^v[1-9][0-9]*$/u),
				rid: z
					.string()
					.regex(/^r[1-9][0-9]*$/u)
					.nullable(),
				role: z.enum(["main", "primary", "side", "appears"]),
				spoil,
			}),
		)
		.max(4096),
	images: z.array(VndbDumpImageSchema).max(1),
});

/** @alpha Public character names, spoiler forms and contextual appearances use exact packet rows. */
export function normalizeVndbCharacterDump(input: unknown) {
	const packet = VndbCharacterDumpSchema.parse(input),
		row = packet.character;
	for (const family of ["names", "aliases", "traits", "vns"] as const)
		if (packet[family].some((value) => value.id !== row.id))
			throw new TypeError("Character dump join belongs to another owner");
	for (const values of [
		packet.names.map((value) => vndbLanguage(value.lang)),
		packet.aliases.map((value) => value.name),
		packet.traits.map((value) => value.tid),
	])
		if (new Set(values).size !== values.length)
			throw new TypeError("Duplicate character dump join key");
	const first = packet.names[0];
	if (!first) throw new TypeError("Character dump name is missing");
	const image = packet.images[0];
	if (row.image === null ? image !== undefined : image?.id !== row.image)
		throw new TypeError("Character image join differs from the selected source image");
	if (row.main === row.id) throw new TypeError("Character cannot be its own instance");
	const apparentSex = row.sex || null,
		actualSex = (row.spoil_sex ?? row.sex) || null;
	const inferredGender = (value: string | null) => (value === "m" || value === "f" ? value : null);
	const apparentGender = row.gender || inferredGender(apparentSex);
	const actualGender = (row.spoil_gender ?? row.gender ?? inferredGender(actualSex)) || null;
	const record = VndbCharacterSchema.parse({
		id: row.id,
		name: first.latin ?? first.name,
		original: first.latin ? first.name : null,
		description: row.description,
		blood_type: row.bloodt === "unknown" ? null : row.bloodt,
		cup: row.cup_size || null,
		height: row.height || null,
		weight: row.weight,
		age: row.age,
		bust: row.s_bust || null,
		waist: row.s_waist || null,
		hips: row.s_hip || null,
		birthday: row.birthday === 0 ? null : [Math.trunc(row.birthday / 100), row.birthday % 100],
		sex: [apparentSex, actualSex],
		gender: [apparentGender, actualGender],
		image: image ? vndbDumpImage(image) : null,
		traits: packet.traits.map((value) => ({ id: value.tid, spoiler: value.spoil, lie: value.lie })),
		vns: packet.vns.map((value) => ({
			id: value.vid,
			role: value.role,
			spoiler: value.spoil,
			release: value.rid === null ? null : { id: value.rid },
		})),
	});
	const names: VndbNativeNamePlan[] = [];
	const addName = (
		key: string,
		path: string,
		value: string,
		latin: string | null,
		languageTag: string | null,
		spoiler: 0 | 1 | 2,
		primary: boolean,
	) => {
		names.push({
			namespace: "vndb.character.name",
			key,
			path: `${path}/name`,
			fields: {
				value,
				languageTag,
				spoiler,
				primaryForLanguage: primary,
				origin: "original",
				kind: primary ? "source-primary" : "source-alias",
			},
		});
		if (latin)
			names.push({
				namespace: "vndb.character.name",
				key: `${key}/latin`,
				derivationKey: key,
				path: `${path}/latin`,
				fields: {
					value: latin,
					languageTag,
					spoiler,
					primaryForLanguage: false,
					origin: "transliteration",
					kind: "source-transliteration",
				},
			});
	};
	for (const [index, value] of packet.names.entries())
		addName(
			`name/${vndbLanguage(value.lang)}`,
			`/names/${index}`,
			value.name,
			value.latin,
			vndbLanguage(value.lang),
			0,
			true,
		);
	for (const [index, value] of packet.aliases.entries())
		addName(
			`alias/${createHash("sha256").update(value.name).digest("hex")}`,
			`/aliases/${index}`,
			value.name,
			value.latin,
			null,
			value.spoil,
			false,
		);
	const extraSemantics: VndbSemanticPlan = { facts: [], relations: [] };
	if (row.main !== null)
		extraSemantics.relations.push({
			key: "instance-of-character",
			path: "/character/main",
			spoiler: row.main_spoil,
			qualifiers: [],
			participants: [
				{
					role: "character",
					target: {
						owner: "entity",
						shape: "character",
						objectType: "character",
						externalId: row.main,
						path: "/character/main",
					},
				},
			],
		});
	const sourcePath = (path: string) => {
		if (path === "/") return "/character";
		if (path.startsWith("/image")) {
			if (path === "/image") return "/character/image";
			const field = path.slice(7),
				sourceField: Record<string, string> = {
					id: "id",
					url: "id",
					"dims/0": "width",
					"dims/1": "height",
					sexual: "c_sexual_avg",
					violence: "c_violence_avg",
					votecount: "c_votecount",
				};
			const column = sourceField[field];
			if (!column) throw new TypeError("Unreviewed character image projection path");
			return `/images/0/${column}`;
		}
		if (path.startsWith("/traits/"))
			return path.replace(/\/id$/u, "/tid").replace(/\/spoiler$/u, "/spoil");
		if (path.startsWith("/vns/"))
			return path
				.replace(/\/release(?:\/id)?$/u, "/rid")
				.replace(/\/id$/u, "/vid")
				.replace(/\/spoiler$/u, "/spoil");
		if (path.startsWith("/birthday")) return "/character/birthday";
		if (path === "/sex/0") return "/character/sex";
		if (path === "/sex/1") return `/character/${row.spoil_sex === null ? "sex" : "spoil_sex"}`;
		if (path === "/gender/0") return `/character/${row.gender ? "gender" : "sex"}`;
		if (path === "/gender/1")
			return `/character/${row.spoil_gender !== null ? "spoil_gender" : row.gender !== null ? "gender" : row.spoil_sex !== null ? "spoil_sex" : "sex"}`;
		const renamed: Record<string, string> = {
			"/blood_type": "bloodt",
			"/cup": "cup_size",
			"/bust": "s_bust",
			"/waist": "s_waist",
			"/hips": "s_hip",
		};
		return `/character/${renamed[path] ?? path.slice(1)}`;
	};
	return { record, names, extraSemantics, sourcePath };
}
