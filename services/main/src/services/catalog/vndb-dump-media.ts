import { z } from "zod";
import formats from "./source-contracts/vndb-dump-link-formats.json";
import type { VndbSemanticPlan } from "./vndb-semantics-contracts";

const number = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sourceId = z
	.string()
	.max(128)
	.regex(/^[a-z]+[1-9][0-9]*$/u);
const httpUrl = z
	.url()
	.max(4096)
	.refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const formatRows = z
	.array(
		z.strictObject({
			site: z.string().min(1),
			label: z.string().min(1),
			format: z.string().nullable(),
		}),
	)
	.length(82)
	.parse(formats.sites);
const linkFormats = new Map(formatRows.map((row) => [row.site, row]));
if (linkFormats.size !== formatRows.length)
	throw new Error("Duplicate reviewed VNDB external site");

/** Pinned ExtLinks.pm formatting, not the informational Kana url_format field; no affiliate parameters. */
export function vndbDumpLinkUrl(site: string, value: string) {
	const rule = linkFormats.get(site);
	if (!rule) throw new TypeError(`Unreviewed VNDB external site: ${site}`);
	const numeric = () => {
		if (!/^[0-9]+$/u.test(value)) throw new TypeError("VNDB numeric site identifier is malformed");
		return BigInt(value).toString();
	};
	let url: string;
	if (rule.format !== null)
		url = rule.format.replace(/%0?(\d*)?([ds])/gu, (_matched, padding: string, type: string) =>
			type === "d" ? numeric().padStart(Number(padding || 0), "0") : value,
		);
	else
		switch (site) {
			case "appstore":
				url = `https://apps.apple.com/app/id${numeric()}`;
				break;
			case "denpa":
				url = `https://denpasoft.com/product/${value}/`;
				break;
			case "dlsite":
				url = `https://www.dlsite.com/home/work/=/product_id/${value}.html`;
				break;
			case "itch": {
				const pieces = z
					.tuple([z.string().regex(/^[a-z0-9_-]+$/u), z.string().regex(/^[a-z0-9_-]+$/u)])
					.parse(value.split("/"));
				url = `https://${pieces[0]}.itch.io/${pieces[1]}`;
				break;
			}
			case "jastusa":
				url = `https://jastusa.com/games/${value}/vndb`;
				break;
			case "jlist":
				url = `https://jlist.com/shop/product/${value}`;
				break;
			case "kagura":
				url = `https://www.kaguragames.com/product/${value}/`;
				break;
			case "mg":
				url = `https://www.mangagamer.com/r18/detail.php?product_code=${numeric()}`;
				break;
			case "playasia":
				url = `https://www.play-asia.com/13/70${value}`;
				break;
			default:
				throw new TypeError("Reviewed VNDB formatter is missing");
		}
	return { url: httpUrl.parse(url), label: rule.label, name: rule.site, id: value };
}

export const VndbDumpImageSchema = z.object({
	id: z
		.string()
		.max(128)
		.regex(/^(?:ch|cv|sf)[1-9][0-9]*$/u),
	width: number.positive().max(32767),
	height: number.positive().max(32767),
	c_votecount: number,
	c_sexual_avg: number.max(200),
	c_violence_avg: number.max(200),
	c_sexual_stddev: number.optional(),
	c_violence_stddev: number.optional(),
	c_weight: number.optional(),
});
export const VndbDumpExternalLinkSchema = z.object({
	id: number.positive(),
	site: z.string(),
	value: z.string().min(1).max(4096),
});
export const VndbDumpExternalBindingSchema = z.object({ id: sourceId, link: number.positive() });

/** The pinned upstream image path algorithm; current public host verified against Kana on 2026-09-07. */
export function vndbDumpImage(input: z.input<typeof VndbDumpImageSchema>) {
	const value = VndbDumpImageSchema.parse(input);
	const match = /^(ch|cv|sf)([1-9][0-9]*)$/u.exec(value.id);
	if (!match?.[1] || !match[2]) throw new TypeError("VNDB image identifier is malformed");
	const identifier = BigInt(match[2]);
	return {
		id: value.id,
		url: `https://t.vndb.org/${match[1]}/${(identifier % 100n).toString().padStart(2, "0")}/${identifier}.jpg`,
		dims: [value.width, value.height] satisfies [number, number],
		sexual: value.c_sexual_avg / 100,
		violence: value.c_violence_avg / 100,
		votecount: value.c_votecount,
	};
}

/** One admitted parent packet joins only its own link rows; missing or extraneous join rows are rejected. */
export function planVndbDumpExternalLinks(
	ownerId: string,
	bindingsInput: unknown,
	linksInput: unknown,
	bindingPath: string,
): VndbSemanticPlan {
	const bindings = z.array(VndbDumpExternalBindingSchema).max(512).parse(bindingsInput);
	const links = z.array(VndbDumpExternalLinkSchema).max(512).parse(linksInput);
	const byId = new Map(links.map((row, position) => [row.id, { row, position }]));
	if (byId.size !== links.length) throw new TypeError("Duplicate VNDB external link join row");
	const used = new Set<number>(),
		plan: VndbSemanticPlan = { facts: [], relations: [] };
	for (const [index, binding] of bindings.entries()) {
		if (binding.id !== ownerId || used.has(binding.link))
			throw new TypeError("VNDB external link binding differs from its parent");
		const joined = byId.get(binding.link);
		if (!joined) throw new TypeError("VNDB external link join is missing");
		const { row, position } = joined;
		used.add(binding.link);
		const formatted = vndbDumpLinkUrl(row.site, row.value),
			path = `/extlinks/${position}`;
		plan.relations.push({
			key: "external-link",
			path: `${bindingPath}/${index}`,
			spoiler: 0,
			participants: [],
			qualifiers: [
				{
					namespace: "catalog.metadata",
					key: "url",
					kind: "string",
					value: formatted.url,
					path: `${path}/value`,
				},
				{
					namespace: "source.vndb.qualifier",
					key: "external-site",
					kind: "string",
					value: row.site,
					path: `${path}/site`,
				},
				{
					namespace: "source.vndb.qualifier",
					key: "external-identifier",
					kind: "string",
					value: row.value,
					path: `${path}/value`,
				},
			],
		});
	}
	if (used.size !== links.length)
		throw new TypeError("VNDB external packet contains unrelated link rows");
	return plan;
}
