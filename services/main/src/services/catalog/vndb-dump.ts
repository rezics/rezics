import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { VndbDumpContractSha256, VndbReleaseSchema } from "./vndb";
import { planVndbRelease, writeVndbReleaseProjection } from "./vndb-release";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import { appendVndbSemanticPlan } from "./vndb-semantics";
import type { VndbSemanticFact, VndbSemanticPlan } from "./vndb-semantics-contracts";
import { softwareComponentSourceOccurrence } from "../database/schema/catalog-software-source";
import { setSoftwareAnimation, vndbAnimation } from "./software-animation";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const releaseId = z.string().regex(/^r\d+$/u);
const animation = z.number().int().nullable().optional();
const ownerRow = z.object({ id: releaseId });

/** A bounded assembled dump document retains public column names and exact row reference paths. */
export const VndbDumpReleaseSchema = z
	.object({
		release: z
			.object({
				id: releaseId,
				olang: z.string(),
				gtin: z.union([z.string().regex(/^\d+$/u), count]),
				released: count,
				voiced: z.number().int().min(0).max(4),
				reso_x: count,
				reso_y: count,
				minage: z.number().int().min(0).max(18).nullable(),
				patch: z.boolean(),
				freeware: z.boolean(),
				uncensored: z.boolean().nullable(),
				official: z.boolean(),
				has_ero: z.boolean(),
				catalog: z.string(),
				notes: z.string(),
				engine: count.nullable(),
				ani_story: z.number().int().min(0).max(4).optional(),
				ani_ero: z.number().int().min(0).max(4).optional(),
				ani_story_sp: animation,
				ani_story_cg: animation,
				ani_cutscene: animation,
				ani_ero_sp: animation,
				ani_ero_cg: animation,
				ani_bg: z.boolean().nullable().optional(),
				ani_face: z.boolean().nullable().optional(),
			})
			.passthrough(),
		titles: z
			.array(
				ownerRow.extend({
					lang: z.string(),
					mtl: z.boolean(),
					title: z.string().nullable(),
					latin: z.string().nullable(),
				}),
			)
			.min(1)
			.max(128),
		platforms: z
			.array(ownerRow.extend({ platform: z.string() }))
			.max(128)
			.default([]),
		media: z
			.array(ownerRow.extend({ medium: z.string(), qty: count }))
			.max(128)
			.default([]),
		vns: z
			.array(
				ownerRow.extend({
					vid: z.string().regex(/^v\d+$/u),
					rtype: z.enum(["trial", "partial", "complete"]),
				}),
			)
			.max(4096)
			.default([]),
		supersedes: z
			.array(ownerRow.extend({ rid: releaseId }))
			.max(4096)
			.default([]),
		producers: z
			.array(
				ownerRow
					.extend({
						pid: z.string().regex(/^p[1-9][0-9]*$/u),
						developer: z.boolean(),
						publisher: z.boolean(),
					})
					.refine((row) => row.developer || row.publisher, "Producer must have a role"),
			)
			.max(4096)
			.default([]),
		drm: z
			.array(ownerRow.extend({ drm: count, notes: z.string() }))
			.max(128)
			.default([]),
	})
	.passthrough()
	.superRefine((value, ctx) => {
		for (const family of [
			"titles",
			"platforms",
			"media",
			"vns",
			"supersedes",
			"drm",
			"producers",
		] as const)
			for (const [index, row] of value[family].entries())
				if (row.id !== value.release.id)
					ctx.addIssue({
						code: "custom",
						path: [family, index, "id"],
						message: "Dump row belongs to another release",
					});
		if (value.titles.filter((title) => title.lang === value.release.olang).length !== 1)
			ctx.addIssue({
				code: "custom",
				path: ["titles"],
				message: "Main release title language must occur exactly once",
			});
		if (new Set(value.titles.map((title) => title.lang)).size !== value.titles.length)
			ctx.addIssue({ code: "custom", path: ["titles"], message: "Duplicate release language" });
	});

export function vndbDumpDate(value: number) {
	if (value === 0) return null;
	if (value === 99999999) return "TBA";
	const year = Math.trunc(value / 10000),
		month = Math.trunc(value / 100) % 100,
		day = value % 100;
	if (
		year < 1 ||
		year > 9999 ||
		(month !== 99 && (month < 1 || month > 12)) ||
		(day !== 99 && (day < 1 || day > 31)) ||
		(month === 99 && day !== 99)
	)
		throw new TypeError("Invalid VNDB dump date sentinel");
	return `${String(year).padStart(4, "0")}${month === 99 ? "" : `-${String(month).padStart(2, "0")}${day === 99 ? "" : `-${String(day).padStart(2, "0")}`}`}`;
}

export function planVndbDumpRelease(input: unknown) {
	const document = VndbDumpReleaseSchema.parse(input);
	const row = document.release;
	const main = document.titles.find((title) => title.lang === row.olang);
	if (!main?.title) throw new TypeError("Dump main title is missing");
	const resolution =
		row.reso_x === 0
			? row.reso_y === 0
				? null
				: row.reso_y === 1
					? "non-standard"
					: undefined
			: [row.reso_x, row.reso_y];
	if (resolution === undefined) throw new TypeError("Invalid VNDB resolution sentinel");
	const plan = planVndbRelease(
		VndbReleaseSchema.parse({
			id: row.id,
			title: main.latin ?? main.title,
			alttitle: main.latin ? main.title : null,
			patch: row.patch,
			freeware: row.freeware,
			uncensored: row.uncensored,
			official: row.official,
			has_ero: row.has_ero,
			minage: row.minage,
			released: vndbDumpDate(row.released),
			voiced: row.voiced === 0 ? null : row.voiced,
			resolution,
			notes: row.notes,
			gtin: String(row.gtin) === "0" ? null : String(row.gtin),
			catalog: row.catalog,
			languages: document.titles.map((title) => ({
				lang: title.lang,
				title: title.title,
				latin: title.latin,
				main: title.lang === row.olang,
				mtl: title.mtl,
			})),
			platforms: document.platforms.map((item) => item.platform),
			media: document.media.map((item) => ({ medium: item.medium, qty: item.qty })),
			vns: document.vns.map((item) => ({ id: item.vid, rtype: item.rtype })),
		}),
	);
	const animationContexts = [
		{ context: "story_sprite" as const, field: "ani_story_sp" as const },
		{ context: "story_scene" as const, field: "ani_story_cg" as const },
		{ context: "cutscene" as const, field: "ani_cutscene" as const },
		{ context: "erotic_sprite" as const, field: "ani_ero_sp" as const },
		{ context: "erotic_scene" as const, field: "ani_ero_cg" as const },
	].flatMap(({ context, field }) =>
		row[field] === undefined ? [] : [vndbAnimation(context, row[field])],
	);
	return { ...plan, document, animationContexts };
}

export async function adoptVndbDumpRelease(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8000000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== VndbDumpContractSha256
	)
		throw new TypeError("VNDB dump archive or contract differs");
	const plan = planVndbDumpRelease(
		JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)),
	);
	if (
		receipt.key.source !== "vndb" ||
		receipt.key.objectType !== "release" ||
		receipt.key.externalId !== plan.record.id
	)
		throw new TypeError("VNDB dump release source identity differs");
	const document = await recordCatalogSourceDocument(tx, receipt, bytes);
	const result = await writeVndbReleaseProjection(
		tx,
		actor,
		plan.record,
		plan.details,
		document,
		(position) => `/vns/${position}/vid`,
		(path) => vndbDumpReleaseSourcePath(plan.document, path),
	);
	if (result.status !== "created") return result;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, document.record.id);
	let revision = result.revision;
	const animationFields = {
		story_sprite: "ani_story_sp",
		story_scene: "ani_story_cg",
		cutscene: "ani_cutscene",
		erotic_sprite: "ani_ero_sp",
		erotic_scene: "ani_ero_cg",
	} as const;
	for (const animation of plan.animationContexts) {
		revision = (await setSoftwareAnimation(tx, result.reference, actor, revision, animation))
			.revision;
		await tx.insert(softwareComponentSourceOccurrence).values({
			...scope,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			ownerId: result.reference.id,
			component: "animation",
			componentKey: animation.context,
			revision,
			sourcePath: `/release/${animationFields[animation.context]}`,
		});
	}
	revision = await appendVndbSemanticPlan(
		tx,
		result.reference,
		actor,
		revision,
		planVndbDumpReleaseSemantics(plan.document),
		document,
	);
	return { ...result, revision };
}

/** @alpha @remarks Dump associations are native qualified relations; supersession never implies patch applicability. */
export function planVndbDumpReleaseSemantics(input: unknown): VndbSemanticPlan {
	const document = VndbDumpReleaseSchema.parse(input);
	const result: VndbSemanticPlan = {
		facts: [
			{
				namespace: "source.vndb.qualifier",
				key: "claimed-official",
				value: document.release.official,
				kind: "boolean",
				path: "/release/official",
			},
		],
		relations: [],
	};
	const fact = (
		key: string,
		value: VndbSemanticFact["value"],
		path: string,
		kind: VndbSemanticFact["kind"],
	): VndbSemanticFact => ({ key, value, path, kind, namespace: "catalog.metadata" });
	const animation = [
		"unknown",
		"none",
		"simple",
		"some_fully_animated_scenes",
		"all_scenes_fully_animated",
	] as const;
	for (const [field, key] of [
		["ani_story", "story-animation-summary"],
		["ani_ero", "erotic-animation-summary"],
	] as const) {
		const code = document.release[field];
		if (code !== undefined)
			result.facts.push(fact(key, animation[code] ?? null, `/release/${field}`, "string"));
	}
	for (const [field, key] of [
		["ani_bg", "background-effects"],
		["ani_face", "animated-facial-features"],
	] as const) {
		const value = document.release[field];
		if (value !== undefined) result.facts.push(fact(key, value, `/release/${field}`, "boolean"));
	}
	for (const [index, row] of document.supersedes.entries()) {
		if (row.rid === document.release.id) throw new TypeError("A release cannot supersede itself");
		result.relations.push({
			key: "supersedes-release",
			path: `/supersedes/${index}`,
			spoiler: 0,
			qualifiers: [],
			participants: [
				{
					role: "release",
					target: {
						owner: "software",
						shape: "release",
						objectType: "release",
						externalId: row.rid,
						path: `/supersedes/${index}/rid`,
					},
				},
			],
		});
	}
	for (const [index, row] of document.drm.entries())
		result.relations.push({
			key: "uses-access-mechanism",
			path: `/drm/${index}`,
			spoiler: 0,
			qualifiers: [fact("access-mechanism-note", row.notes, `/drm/${index}/notes`, "string")],
			participants: [
				{
					role: "mechanism",
					target: {
						owner: "reference",
						shape: "access-mechanism",
						objectType: "drm",
						externalId: String(row.drm),
						path: `/drm/${index}/drm`,
					},
				},
			],
		});
	if (document.release.engine !== null)
		result.relations.push({
			key: "uses-software-engine",
			path: "/release/engine",
			spoiler: 0,
			qualifiers: [],
			participants: [
				{
					role: "engine",
					target: {
						owner: "software",
						shape: "engine",
						objectType: "engine",
						externalId: String(document.release.engine),
						path: "/release/engine",
					},
				},
			],
		});
	for (const [index, row] of document.producers.entries())
		for (const [field, key] of [
			["developer", "developed-by"],
			["publisher", "published-by"],
		] as const)
			if (row[field])
				result.relations.push({
					key,
					path: `/producers/${index}/${field}`,
					spoiler: 0,
					qualifiers: [],
					participants: [
						{
							role: "producer",
							target: {
								owner: "entity",
								shape: "unresolved",
								objectType: "producer",
								externalId: row.pid,
								path: `/producers/${index}/pid`,
							},
						},
					],
				});
	return result;
}

/** @internal API-shaped planning paths resolve to original assembled public dump columns. */
export function vndbDumpReleaseSourcePath(
	document: z.output<typeof VndbDumpReleaseSchema>,
	path: string,
) {
	if (path === "/") return "/release";
	if (path === "/title") {
		const index = document.titles.findIndex((title) => title.lang === document.release.olang);
		const main = document.titles[index];
		if (!main) throw new TypeError("Dump main title is missing");
		return `/titles/${index}/${main.latin ? "latin" : "title"}`;
	}
	if (path.startsWith("/languages/")) return path.replace("/languages/", "/titles/");
	return path;
}
