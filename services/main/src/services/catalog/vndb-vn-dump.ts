import { z } from "zod";
import { VndbVnSchema } from "./vndb";
import { planVndbSemantics } from "./vndb-semantics-contracts";
import {
	VndbDumpImageSchema,
	VndbDumpExternalBindingSchema,
	VndbDumpExternalLinkSchema,
	planVndbDumpExternalLinks,
	vndbDumpImage,
} from "./vndb-dump-media";

const id = z.string().regex(/^v[1-9][0-9]*$/u);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().min(1).max(131072);
const owner = z.object({ id });
export const VndbVnDumpSchema = z.object({
	vn: owner.extend({
		image: z
			.string()
			.regex(/^cv[1-9][0-9]*$/u)
			.nullable(),
		c_image: z
			.string()
			.regex(/^cv[1-9][0-9]*$/u)
			.nullable(),
		olang: z.string(),
		c_votecount: integer,
		c_rating: integer.nullable(),
		c_average: integer.nullable(),
		c_length: integer.nullable(),
		c_lengthnum: integer,
		length: integer.max(5),
		devstatus: integer.max(2),
		alias: z.string().max(131072),
		description: z.string().max(524288),
	}),
	titles: z
		.array(
			owner.extend({
				lang: z.string(),
				official: z.boolean(),
				title: text,
				latin: text.nullable(),
			}),
		)
		.min(1)
		.max(128),
	editions: z
		.array(
			owner.extend({
				lang: z.string().nullable(),
				eid: integer,
				official: z.boolean(),
				name: z.string().max(131072),
			}),
		)
		.max(128),
	staff: z
		.array(
			owner.extend({
				aid: integer.positive(),
				role: z.string(),
				eid: integer.nullable(),
				note: z.string().max(16384),
			}),
		)
		.max(4096),
	seiyuu: z
		.array(
			owner.extend({
				cid: z.string().regex(/^c[1-9][0-9]*$/u),
				aid: integer.positive(),
				note: z.string().max(16384),
			}),
		)
		.max(4096),
	staff_alias: z
		.array(
			z.object({
				id: z.string().regex(/^s[1-9][0-9]*$/u),
				aid: integer.positive(),
				name: text,
				latin: text.nullable(),
			}),
		)
		.max(8192),
	relations: z
		.array(
			owner.extend({
				vid: id,
				relation: z.enum([
					"seq",
					"preq",
					"set",
					"alt",
					"char",
					"side",
					"par",
					"ser",
					"fan",
					"orig",
				]),
				official: z.boolean(),
			}),
		)
		.max(4096),
	screenshots: z
		.array(
			owner.extend({
				scr: z.string().regex(/^sf[1-9][0-9]*$/u),
				rid: z
					.string()
					.regex(/^r[1-9][0-9]*$/u)
					.nullable(),
			}),
		)
		.max(4096),
	images: z.array(VndbDumpImageSchema).max(4098),
	links: z.array(VndbDumpExternalBindingSchema).max(512),
	extlinks: z.array(VndbDumpExternalLinkSchema).max(512),
	anime: z.array(owner.extend({ aid: integer.positive().max(2147483647) })).max(4096),
});

/** @alpha One bounded VN packet joins exact staff aliases and snapshot-local contexts before native adoption. */
export function normalizeVndbVnDump(input: unknown) {
	const packet = VndbVnDumpSchema.parse(input),
		row = packet.vn;
	for (const family of [
		"titles",
		"editions",
		"staff",
		"seiyuu",
		"relations",
		"screenshots",
		"anime",
	] as const)
		if (packet[family].some((value) => value.id !== row.id))
			throw new TypeError("VN dump join belongs to another source owner");
	const mainIndex = packet.titles.findIndex((value) => value.lang === row.olang),
		main = packet.titles[mainIndex];
	if (!main || packet.titles.filter((value) => value.lang === row.olang).length !== 1)
		throw new TypeError("VN original-language title join is missing or ambiguous");
	for (const values of [
		packet.titles.map((value) => value.lang),
		packet.editions.map((value) => value.eid),
		packet.relations.map((value) => value.vid),
		packet.screenshots.map((value) => value.scr),
		packet.seiyuu.map((value) => `${value.aid}/${value.cid}`),
		packet.anime.map((value) => value.aid),
	])
		if (new Set<string | number>(values).size !== values.length)
			throw new TypeError("Duplicate VN dump join key");
	const aliases = new Map(packet.staff_alias.map((value, index) => [value.aid, { value, index }]));
	if (aliases.size !== packet.staff_alias.length)
		throw new TypeError("Duplicate global staff alias join key");
	const usedAliases = new Set<number>();
	const alias = (aid: number) => {
		const found = aliases.get(aid);
		if (!found) throw new TypeError("VN staff alias dependency is missing");
		usedAliases.add(aid);
		return found;
	};
	const staff = packet.staff.map((value) => {
		const joined = alias(value.aid).value;
		return {
			...value,
			id: joined.id,
			name: joined.latin ?? joined.name,
			original: joined.latin ? joined.name : null,
		};
	});
	const va = packet.seiyuu.map((value) => {
		const joined = alias(value.aid).value;
		return {
			staff: {
				id: joined.id,
				aid: joined.aid,
				name: joined.latin ?? joined.name,
				original: joined.latin ? joined.name : null,
			},
			character: { id: value.cid },
			note: value.note,
		};
	});
	if (usedAliases.size !== aliases.size)
		throw new TypeError("VN packet contains unrelated staff alias rows");
	const images = new Map(packet.images.map((value, index) => [value.id, { value, index }]));
	if (images.size !== packet.images.length) throw new TypeError("Duplicate image join key");
	const usedImages = new Set<string>();
	const image = (imageId: string) => {
		const found = images.get(imageId);
		if (!found) throw new TypeError("VN image dependency is missing");
		usedImages.add(imageId);
		return vndbDumpImage(found.value);
	};
	const record = VndbVnSchema.parse({
		id: row.id,
		title: main.latin ?? main.title,
		alttitle: main.latin ? main.title : null,
		olang: row.olang,
		titles: packet.titles.map((value) => ({ ...value, main: value.lang === row.olang })),
		aliases: row.alias === "" ? [] : row.alias.split("\n"),
		description: row.description || null,
		devstatus: row.devstatus,
		length: row.length || null,
		length_minutes: row.c_length,
		length_votes: row.c_lengthnum,
		average: row.c_average === null ? null : row.c_average / 10,
		rating: row.c_rating === null ? null : row.c_rating / 10,
		votecount: row.c_votecount,
		editions: packet.editions,
		staff,
		va,
		relations: packet.relations.map((value) => ({
			id: value.vid,
			relation: value.relation,
			relation_official: value.official,
		})),
		image: row.c_image === null ? null : image(row.c_image),
		screenshots: packet.screenshots.map((value) => ({
			...image(value.scr),
			...(value.rid === null ? {} : { release: { id: value.rid } }),
		})),
	});
	const editorialImage = row.image !== null && row.image !== row.c_image ? image(row.image) : null;
	if (usedImages.size !== images.size)
		throw new TypeError("VN packet contains unrelated image rows");
	const imagePath = (imageId: string | null, tail: string) => {
		const found = imageId === null ? undefined : images.get(imageId);
		if (!found) throw new TypeError("VN image evidence join is missing");
		const fields: Record<string, string> = {
			id: "id",
			url: "id",
			"dims/0": "width",
			"dims/1": "height",
			sexual: "c_sexual_avg",
			violence: "c_violence_avg",
			votecount: "c_votecount",
		};
		const field = fields[tail];
		if (!field) throw new TypeError("Unreviewed VN image evidence path");
		return `/images/${found.index}/${field}`;
	};
	const sourcePath = (path: string): string => {
		if (path === "/") return "/vn";
		if (path === "/title") return `/titles/${mainIndex}/${main.latin ? "latin" : "title"}`;
		if (path === "/alttitle") return `/titles/${mainIndex}/title`;
		if (path.startsWith("/titles/") || path.startsWith("/editions/")) return path;
		if (path.startsWith("/aliases/")) return "/vn/alias";
		if (path === "/image") return "/vn/c_image";
		if (path.startsWith("/image/")) return imagePath(row.c_image, path.slice(7));
		const screenshot = /^\/screenshots\/(\d+)(?:\/(.*))?$/u.exec(path);
		if (screenshot) {
			const index = Number(screenshot[1]),
				value = packet.screenshots[index],
				tail = screenshot[2];
			if (!value) throw new TypeError("VN screenshot evidence row is missing");
			if (!tail) return `/screenshots/${index}`;
			if (tail === "release/id") return `/screenshots/${index}/rid`;
			return imagePath(value.scr, tail);
		}
		const credit = /^\/(staff|va)\/(\d+)(?:\/(.*))?$/u.exec(path);
		if (credit) {
			const index = Number(credit[2]),
				voice = credit[1] === "va",
				tail = credit[3],
				value = voice ? packet.seiyuu[index] : packet.staff[index];
			if (!value) throw new TypeError("VN credit evidence row is missing");
			const base = `/${voice ? "seiyuu" : "staff"}/${index}`;
			if (!tail) return base;
			if (tail === "character/id") return `${base}/cid`;
			const aliasField = voice ? tail.replace(/^staff\//u, "") : tail;
			if (["id", "name", "original"].includes(aliasField)) {
				const joined = alias(value.aid);
				return `/staff_alias/${joined.index}/${aliasField === "id" ? "id" : aliasField === "original" ? "name" : joined.value.latin ? "latin" : "name"}`;
			}
			return `${base}/${aliasField}`;
		}
		if (path.startsWith("/relations/"))
			return path.replace(/\/id$/u, "/vid").replace(/\/relation_official$/u, "/official");
		const fields: Record<string, string> = {
			"/length_minutes": "c_length",
			"/length_votes": "c_lengthnum",
			"/average": "c_average",
			"/rating": "c_rating",
			"/votecount": "c_votecount",
		};
		return `/vn/${fields[path] ?? path.slice(1)}`;
	};
	const extraSemantics = planVndbDumpExternalLinks(row.id, packet.links, packet.extlinks, "/links");
	for (const [index, anime] of packet.anime.entries())
		extraSemantics.relations.push({
			key: "related-program",
			path: `/anime/${index}`,
			spoiler: 0,
			qualifiers: [],
			participants: [
				{
					role: "program",
					target: {
						owner: "program",
						shape: "program",
						objectType: "anime",
						externalId: String(anime.aid),
						path: `/anime/${index}/aid`,
					},
				},
			],
		});
	if (editorialImage) {
		const editorial = planVndbSemantics({ id: row.id, image: editorialImage });
		for (const relation of editorial.relations) {
			relation.path = "/vn/image";
			for (const qualifier of relation.qualifiers) {
				qualifier.path =
					qualifier.path === "/image" ? "/vn/image" : imagePath(row.image, qualifier.path.slice(7));
				if (qualifier.key === "image-purpose") qualifier.value = "source-editorial";
			}
			for (const participant of relation.participants)
				participant.target.path = imagePath(row.image, "id");
		}
		extraSemantics.relations.push(...editorial.relations);
	}
	return {
		record,
		sourcePath,
		extraSemantics,
	};
}
