import { z } from "zod";
import { vndbLanguage } from "./vndb";
import type { CatalogOwner } from "@rezics/schema/contracts/native/catalog";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const text = z.string().max(131_072);
const spoiler = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const externalId = z.union([z.string().min(1).max(512), count]);
const url = z
	.url()
	.max(4096)
	.refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const dimensions = z.tuple([count.positive(), count.positive()]);
const image = z.object({
	id: z.string().regex(/^(?:cv|ch|sf|st)\d+$/u),
	url: url.optional(),
	dims: dimensions.optional(),
	sexual: z.number().min(0).max(2).optional(),
	violence: z.number().min(0).max(2).optional(),
	votecount: count.optional(),
	thumbnail: url.optional(),
	thumbnail_dims: dimensions.optional(),
	type: z.enum(["pkgfront", "pkgback", "pkgcontent", "pkgside", "pkgmed", "dig"]).optional(),
	vn: z
		.string()
		.regex(/^v\d+$/u)
		.nullable()
		.optional(),
	languages: z.array(z.string().min(1).max(255)).max(128).nullable().optional(),
	photo: z.boolean().optional(),
	release: z
		.object({ id: z.string().regex(/^r\d+$/u) })
		.nullable()
		.optional(),
});
const vnRelation = z.enum([
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
]);
const producerRelation = z.enum(["old", "new", "spa", "ori", "sub", "par", "imp", "ipa"]);
const relations = z
	.array(
		z.object({
			id: z.string().regex(/^[vp]\d+$/u),
			relation: z.union([vnRelation, producerRelation]),
			relation_official: z.boolean().optional(),
			title: text.optional(),
			name: text.optional(),
		}),
	)
	.max(512);

/** @alpha Selected source fields for the catalog mapper; missing fields are never invented. */
export const VndbSemanticFieldsSchema = z.object({
	id: z.string().regex(/^[vrcspgiq]\d+$/u),
	description: text.nullable().optional(),
	official: z.boolean().optional(),
	lang: z.string().optional(),
	extlinks: z
		.array(
			z.object({
				url,
				label: text.optional(),
				name: z.string().min(1).max(128).optional(),
				id: externalId.optional(),
			}),
		)
		.max(512)
		.optional(),
	producers: z
		.array(
			z
				.object({
					id: z.string().regex(/^p[1-9][0-9]*$/u),
					developer: z.boolean(),
					publisher: z.boolean(),
				})
				.refine((row) => row.developer || row.publisher, "Producer must have a role"),
		)
		.max(512)
		.optional(),
	image: image.nullable().optional(),
	images: z.array(image).max(512).optional(),
	screenshots: z.array(image).max(512).optional(),
	average: z.number().min(10).max(100).nullable().optional(),
	rating: z.number().min(10).max(100).nullable().optional(),
	votecount: count.optional(),
	length_votes: count.optional(),
	length_minutes: count.nullable().optional(),
	length: z.number().int().min(1).max(5).nullable().optional(),
	vn_count: count.optional(),
	char_count: count.optional(),
	score: z.number().int().min(-32768).max(32767).optional(),
	relations: relations.optional(),
	tags: z
		.array(
			z.object({
				id: z.string().regex(/^g\d+$/u),
				name: text.optional(),
				rating: z.number().positive().max(3).optional(),
				spoiler: spoiler.optional(),
				lie: z.boolean().optional(),
			}),
		)
		.max(512)
		.optional(),
	traits: z
		.array(
			z.object({
				id: z.string().regex(/^i\d+$/u),
				name: text.optional(),
				spoiler: spoiler.optional(),
				lie: z.boolean().optional(),
			}),
		)
		.max(512)
		.optional(),
	vns: z
		.array(
			z.object({
				id: z.string().regex(/^v\d+$/u),
				role: z.enum(["main", "primary", "side", "appears"]).optional(),
				spoiler: spoiler.optional(),
				release: z
					.object({ id: z.string().regex(/^r\d+$/u) })
					.nullable()
					.optional(),
			}),
		)
		.max(512)
		.optional(),
});

/** @alpha Dump parent edges retain DAG multiplicity and the source's main-parent flag. */
export const VndbHierarchyEdgeSchema = z
	.strictObject({
		id: z.string().regex(/^[gi]\d+$/u),
		parent: z.string().regex(/^[gi]\d+$/u),
		main: z.boolean(),
	})
	.refine(
		(edge) => edge.id[0] === edge.parent[0] && edge.id !== edge.parent,
		"Taxonomy parent must be a distinct member of the same vocabulary",
	);

/** @alpha Source-independent typed scalar facts; their source support is stored separately. */
export type VndbSemanticFact = {
	namespace: "catalog" | "catalog.metadata" | "source.vndb.statistics" | "source.vndb.qualifier";
	key: string;
	value: string | number | boolean | null;
	kind: "string" | "number" | "boolean";
	path: string;
	spoiler?: 0 | 1 | 2;
	constraints?: {
		nullable: boolean;
		integer: boolean;
		minimum?: number;
		maximum?: number;
		unit?: string;
		allowedValues?: string[];
	};
};
export type VndbSemanticTarget = {
	owner: CatalogOwner;
	shape: string;
	objectType: string;
	externalId: string;
	path: string;
	name?: string;
};
export type VndbSemanticRelation = {
	key: string;
	path: string;
	spoiler: 0 | 1 | 2;
	participants: { role: string; target: VndbSemanticTarget }[];
	qualifiers: VndbSemanticFact[];
};
export type VndbSemanticPlan = { facts: VndbSemanticFact[]; relations: VndbSemanticRelation[] };

const vnMeanings = {
	seq: "has-sequel",
	preq: "has-prequel",
	set: "shares-setting",
	alt: "has-alternative-version",
	char: "shares-characters",
	side: "has-side-story",
	par: "has-parent-story",
	ser: "shares-series",
	fan: "has-fan-disc",
	orig: "has-original-game",
} as const;
const producerMeanings = {
	old: "formerly-known-as",
	new: "succeeded-by",
	spa: "spawned-organization",
	ori: "originated-from-organization",
	sub: "has-subsidiary",
	par: "has-parent-organization",
	imp: "has-imprint",
	ipa: "has-parent-brand",
} as const;
const characterRoles = {
	main: "protagonist",
	primary: "principal-character",
	side: "supporting-character",
	appears: "appearing-character",
} as const;

function fact(
	key: string,
	value: string | number | boolean | null,
	path: string,
	kind: VndbSemanticFact["kind"],
	namespace: VndbSemanticFact["namespace"] = "catalog.metadata",
): VndbSemanticFact {
	return { key, value, path, kind, namespace };
}
function target(id: string, path: string, name?: string): VndbSemanticTarget {
	const owner: CatalogOwner =
		id.startsWith("v") || id.startsWith("r")
			? "software"
			: id.startsWith("c") || id.startsWith("p")
				? "entity"
				: "reference";
	const shape = id.startsWith("v")
		? "content"
		: id.startsWith("r")
			? "release"
			: id.startsWith("c")
				? "character"
				: id.startsWith("p")
					? "unresolved"
					: "concept";
	const objectType = id.startsWith("v")
		? "vn"
		: id.startsWith("r")
			? "release"
			: id.startsWith("c")
				? "character"
				: id.startsWith("p")
					? "producer"
					: id.startsWith("g")
						? "tag"
						: "trait";
	return { owner, shape, objectType, externalId: id, path, name };
}

/**
 * @alpha Deterministic projection into governed facts and relations.
 * @remarks Each selected collection is capped at 512 occurrences. Importers split larger
 * dump relations into bounded commands; this function never traverses a taxonomy closure.
 */
export function planVndbSemantics(input: unknown): VndbSemanticPlan {
	const record = VndbSemanticFieldsSchema.parse(input);
	const plan: VndbSemanticPlan = { facts: [], relations: [] };
	const addRelation = (relation: VndbSemanticRelation) => {
		if (plan.relations.length >= 2048)
			throw new RangeError("VNDB semantic command exceeds its bounded occurrence budget");
		plan.relations.push(relation);
	};
	if ((record.id.startsWith("s") || record.id.startsWith("p")) && record.lang !== undefined)
		plan.facts.push(fact("primary-language", vndbLanguage(record.lang), "/lang", "string"));
	if (record.description !== undefined && !record.id.startsWith("v"))
		plan.facts.push(fact("description.vndb-markup", record.description, "/description", "string"));
	if (record.id.startsWith("r") && record.official !== undefined)
		plan.facts.push(
			fact("claimed-official", record.official, "/official", "boolean", "source.vndb.qualifier"),
		);
	if (
		record.id.startsWith("v") &&
		(record.length_minutes !== undefined ||
			record.length_votes !== undefined ||
			record.length !== undefined)
	) {
		const reported = record.length_minutes !== undefined || record.length_votes !== undefined;
		const evidence =
			record.length_minutes !== undefined
				? "/length_minutes"
				: record.length_votes !== undefined
					? "/length_votes"
					: "/length";
		const qualifiers: VndbSemanticFact[] = [
			fact(
				"playtime-estimator",
				reported ? "reported_average" : "editorial_category",
				evidence,
				"string",
			),
			fact("playtime-basis", reported ? "user_reports" : "source_editorial", evidence, "string"),
		];
		if (record.length_minutes !== undefined)
			qualifiers.push(
				fact("playtime-estimate-minutes", record.length_minutes, "/length_minutes", "number"),
			);
		if (record.length_votes !== undefined)
			qualifiers.push(
				fact("playtime-sample-count", record.length_votes, "/length_votes", "number"),
			);
		if (record.length !== undefined) {
			const categories = ["very_short", "short", "medium", "long", "very_long"] as const;
			qualifiers.push(
				fact(
					"playtime-rough-category",
					record.length === null ? null : (categories[record.length - 1] ?? null),
					"/length",
					"string",
				),
			);
		}
		addRelation({
			key: "reported-playtime-estimate",
			path: "/",
			spoiler: 0,
			participants: [],
			qualifiers,
		});
	}
	// Cached source aggregates are available through the immutable source-field reader.
	// They are not duplicated into corpus-scale native OLTP fact tables.
	for (const [i, link] of (record.extlinks ?? []).entries()) {
		const path = `/extlinks/${i}`;
		// One URL relation binds label/site/identifier to this exact occurrence, including redundant sites.
		const qualifiers = [fact("url", link.url, `${path}/url`, "string")];
		if (link.label !== undefined)
			qualifiers.push(fact("link-label", link.label, `${path}/label`, "string"));
		if (link.name !== undefined)
			qualifiers.push(
				fact("external-site", link.name, `${path}/name`, "string", "source.vndb.qualifier"),
			);
		if (link.id !== undefined)
			qualifiers.push(
				fact(
					"external-identifier",
					String(link.id),
					`${path}/id`,
					"string",
					"source.vndb.qualifier",
				),
			);
		addRelation({ key: "external-link", path, spoiler: 0, qualifiers, participants: [] });
	}
	for (const [collection, images] of [
		["image", record.image ? [record.image] : []],
		["images", record.images ?? []],
		["screenshots", record.screenshots ?? []],
	] as const) {
		for (const [i, asset] of images.entries()) {
			const path = collection === "image" ? "/image" : `/${collection}/${i}`;
			const qualifiers: VndbSemanticFact[] = [
				fact(
					"image-purpose",
					collection === "screenshots"
						? "screenshot"
						: collection === "image"
							? "primary"
							: "release-artwork",
					path,
					"string",
				),
			];
			for (const field of ["url", "thumbnail"] as const)
				if (asset[field] !== undefined)
					qualifiers.push(fact(`image-${field}`, asset[field], `${path}/${field}`, "string"));
			for (const field of ["dims", "thumbnail_dims"] as const)
				if (asset[field]) {
					qualifiers.push(
						fact(`image-${field}-width`, asset[field][0], `${path}/${field}/0`, "number"),
					);
					qualifiers.push(
						fact(`image-${field}-height`, asset[field][1], `${path}/${field}/1`, "number"),
					);
				}
			for (const field of ["sexual", "violence"] as const)
				if (asset[field] !== undefined)
					qualifiers.push(
						fact(
							`image-${field}`,
							asset[field],
							`${path}/${field}`,
							"number",
							"source.vndb.statistics",
						),
					);
			if (asset.type !== undefined)
				qualifiers.push(
					fact("image-type", asset.type, `${path}/type`, "string", "source.vndb.qualifier"),
				);
			if (asset.photo !== undefined)
				qualifiers.push(fact("is-photograph", asset.photo, `${path}/photo`, "boolean"));
			if (asset.languages !== undefined)
				qualifiers.push(
					fact(
						"image-all-release-languages",
						asset.languages === null,
						`${path}/languages`,
						"boolean",
					),
				);
			const participants = [
				{
					role: "image",
					target: {
						owner: "reference" as const,
						shape: "image",
						objectType: "image",
						externalId: asset.id,
						path: `${path}/id`,
					},
				},
			];
			const scoped: VndbSemanticRelation["participants"] = [...participants];
			if (asset.vn) scoped.push({ role: "content", target: target(asset.vn, `${path}/vn`) });
			if (asset.release)
				scoped.push({ role: "release", target: target(asset.release.id, `${path}/release/id`) });
			// Each language scope is a bounded relation occurrence, preserving the exact image and
			// source context without growing an unbounded per-relation qualifier list.
			if (asset.languages?.length)
				for (const [j, language] of asset.languages.entries()) {
					addRelation({
						key: "has-image",
						path,
						spoiler: 0,
						participants: scoped,
						qualifiers: [
							...qualifiers,
							fact(
								"image-source-language",
								language,
								`${path}/languages/${j}`,
								"string",
								"source.vndb.qualifier",
							),
						],
					});
				}
			else addRelation({ key: "has-image", path, spoiler: 0, qualifiers, participants: scoped });
		}
	}
	for (const [i, relation] of (record.relations ?? []).entries()) {
		const path = `/relations/${i}`;
		const sameKind = record.id[0] === relation.id[0] && record.id !== relation.id;
		if (!sameKind) throw new TypeError("VNDB relation crosses unrelated source object kinds");
		const key = record.id.startsWith("v")
			? vnMeanings[vnRelation.parse(relation.relation)]
			: producerMeanings[producerRelation.parse(relation.relation)];
		const qualifiers = [
			fact(
				"relation-code",
				relation.relation,
				`${path}/relation`,
				"string",
				"source.vndb.qualifier",
			),
		];
		if (relation.relation_official !== undefined)
			qualifiers.push(
				fact(
					"claimed-official",
					relation.relation_official,
					`${path}/relation_official`,
					"boolean",
					"source.vndb.qualifier",
				),
			);
		addRelation({
			key,
			path,
			spoiler: 0,
			qualifiers,
			participants: [
				{
					role: "related",
					target: target(relation.id, `${path}/id`, relation.title ?? relation.name),
				},
			],
		});
	}
	for (const [collection, values] of [
		["tags", record.tags ?? []],
		["traits", record.traits ?? []],
	] as const) {
		for (const [i, term] of values.entries()) {
			const path = `/${collection}/${i}`;
			const qualifiers: VndbSemanticFact[] = [];
			if (term.lie !== undefined)
				qualifiers.push(
					fact("known-false", term.lie, `${path}/lie`, "boolean", "source.vndb.qualifier"),
				);
			if ("rating" in term && typeof term.rating === "number")
				qualifiers.push(
					fact("tag-rating", term.rating, `${path}/rating`, "number", "source.vndb.statistics"),
				);
			qualifiers.push(
				fact(
					"spoiler-level",
					term.spoiler ?? null,
					`${path}/spoiler`,
					"number",
					"source.vndb.qualifier",
				),
			);
			addRelation({
				key: collection === "tags" ? "has-subject-tag" : "has-character-trait",
				path,
				spoiler: term.spoiler ?? 2,
				qualifiers,
				participants: [{ role: "concept", target: target(term.id, `${path}/id`, term.name) }],
			});
		}
	}
	for (const [index, producer] of (record.producers ?? []).entries()) {
		if (!record.id.startsWith("r")) throw new TypeError("Release producer roles require a release");
		for (const [field, key] of [
			["developer", "developed-by"],
			["publisher", "published-by"],
		] as const)
			if (producer[field])
				addRelation({
					key,
					path: `/producers/${index}/${field}`,
					spoiler: 0,
					qualifiers: [],
					participants: [
						{ role: "producer", target: target(producer.id, `/producers/${index}/id`) },
					],
				});
	}
	if (record.id.startsWith("c"))
		for (const [i, appearance] of (record.vns ?? []).entries()) {
			const path = `/vns/${i}`;
			const participants = [{ role: "content", target: target(appearance.id, `${path}/id`) }];
			if (appearance.release)
				participants.push({
					role: "release",
					target: target(appearance.release.id, `${path}/release/id`),
				});
			addRelation({
				key: "character-appears-in",
				path,
				spoiler: appearance.spoiler ?? 2,
				participants,
				qualifiers: [
					fact(
						"spoiler-level",
						appearance.spoiler ?? null,
						`${path}/spoiler`,
						"number",
						"source.vndb.qualifier",
					),
					...(appearance.role === undefined
						? []
						: [fact("character-role", characterRoles[appearance.role], `${path}/role`, "string")]),
				],
			});
		}
	if (plan.facts.length + plan.relations.length > 2048)
		throw new RangeError("VNDB semantic command exceeds its bounded occurrence budget");
	return plan;
}

/** @alpha Independently adoptable vocabulary entries and quotations. */
export const VndbSemanticObjectSchema = z.discriminatedUnion("objectType", [
	z.object({
		objectType: z.literal("tag"),
		id: z.string().regex(/^g\d+$/u),
		name: text.min(1),
		aliases: z.array(text).max(512).optional(),
		description: text.optional(),
		category: z.enum(["cont", "ero", "tech"]).optional(),
		searchable: z.boolean().optional(),
		applicable: z.boolean().optional(),
		vn_count: count.optional(),
		defaultspoil: spoiler.optional(),
	}),
	z.object({
		objectType: z.literal("trait"),
		id: z.string().regex(/^i\d+$/u),
		name: text.min(1),
		aliases: z.array(text).max(512).optional(),
		description: text.optional(),
		searchable: z.boolean().optional(),
		applicable: z.boolean().optional(),
		sexual: z.boolean().optional(),
		group_id: z
			.string()
			.regex(/^i\d+$/u)
			.nullable()
			.optional(),
		group_name: text.optional(),
		char_count: count.optional(),
		defaultspoil: spoiler.optional(),
		gorder: z.number().int().min(-32768).max(32767).optional(),
	}),
	z.object({
		objectType: z.literal("quote"),
		id: z.string().regex(/^q\d+$/u),
		quote: text.min(1),
		score: z.number().int().min(-32768).max(32767).optional(),
		vn: z.object({ id: z.string().regex(/^v\d+$/u) }),
		character: z
			.object({ id: z.string().regex(/^c\d+$/u) })
			.nullable()
			.optional(),
	}),
	z.object({
		objectType: z.literal("drm"),
		id: count.positive(),
		name: text.min(1),
		description: text.optional(),
		disc: z.boolean(),
		cdkey: z.boolean(),
		activate: z.boolean(),
		alimit: z.boolean(),
		account: z.boolean(),
		online: z.boolean(),
		cloud: z.boolean(),
		physical: z.boolean(),
	}),
	z.object({
		objectType: z.literal("engine"),
		id: count.positive(),
		name: text.min(1),
		description: text.optional(),
	}),
]);

export const VndbSemanticRelations = { vn: vnMeanings, producer: producerMeanings } as const;
