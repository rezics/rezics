import { createHash } from "node:crypto";
import { z } from "zod";
import {
	VndbStaffSchema,
	VndbProducerSchema,
	VndbCharacterSchema,
	planVndbStaffNames,
	planVndbCharacterFacts,
} from "./vndb-entities";
import {
	VndbSemanticObjectSchema,
	planVndbSemantics,
	type VndbSemanticFact,
	type VndbSemanticPlan,
	type VndbSemanticRelation,
} from "./vndb-semantics-contracts";
import type { VndbNativeNamePlan } from "./vndb-names-update";

export const VndbSupportingRecordSchema = z.discriminatedUnion("objectType", [
	VndbStaffSchema.safeExtend({ objectType: z.literal("staff") }),
	VndbProducerSchema.extend({ objectType: z.literal("producer") }),
	VndbCharacterSchema.extend({ objectType: z.literal("character") }),
	...VndbSemanticObjectSchema.options,
]);
export type VndbSupportingRecord = z.output<typeof VndbSupportingRecordSchema>;

export const vndbCharacterPropertyDefinitions: VndbSemanticFact[] = planVndbCharacterFacts({
	id: "c1",
	name: "Definition template",
	height: null,
	weight: null,
	bust: null,
	waist: null,
	hips: null,
	age: null,
	blood_type: null,
	cup: null,
	birthday: null,
	sex: null,
	gender: null,
}).map((value) => ({
	namespace: "catalog",
	key: value.key,
	kind: value.valueKind,
	value: null,
	path: "/",
	constraints: {
		nullable: true,
		integer: value.valueKind === "number",
		...(value.minimum === undefined ? {} : { minimum: value.minimum }),
		...(value.maximum === undefined ? {} : { maximum: value.maximum }),
		...(value.unit === undefined ? {} : { unit: value.unit }),
		...(value.allowedValues === undefined ? {} : { allowedValues: value.allowedValues }),
	},
}));

export function planVndbSupportingNames(record: VndbSupportingRecord): VndbNativeNamePlan[] {
	const plan: VndbNativeNamePlan[] = [];
	if (record.objectType === "quote") return plan;
	if (record.objectType === "staff") {
		for (const alias of planVndbStaffNames(record).sort(
			(left, right) => Number(right.ismain) - Number(left.ismain),
		)) {
			const key = String(alias.aid);
			plan.push({
				namespace: "vndb.staff.alias",
				key,
				path: alias.aliasPath,
				fields: {
					value: alias.value,
					kind: alias.ismain ? "source-primary" : "source-alias",
					origin: "original",
					primaryForLanguage: alias.ismain,
					languageTag: null,
				},
			});
			if (alias.latin)
				plan.push({
					namespace: "vndb.staff.alias",
					key: `${key}/latin`,
					path: alias.latinPath,
					derivationKey: key,
					fields: {
						value: alias.latin,
						kind: "source-transliteration",
						origin: "transliteration",
						primaryForLanguage: false,
						languageTag: null,
					},
				});
		}
		return plan;
	}
	const namespace = `vndb.${record.objectType}.name` as const;
	const original = "original" in record ? record.original : null;
	plan.push({
		namespace,
		key: "primary",
		path: original ? "/original" : "/name",
		fields: {
			value: original ?? record.name,
			kind: "source-primary",
			origin: "original",
			primaryForLanguage: true,
			languageTag: null,
		},
	});
	if (original && original !== record.name)
		plan.push({
			namespace,
			key: "latin",
			path: "/name",
			derivationKey: "primary",
			fields: {
				value: record.name,
				kind: "source-transliteration",
				origin: "transliteration",
				primaryForLanguage: false,
				languageTag: null,
			},
		});
	const duplicates = new Map<string, number>();
	if ("aliases" in record)
		for (const [index, value] of (record.aliases ?? []).entries()) {
			if (!value) continue;
			const hash = createHash("sha256").update(value).digest("hex"),
				occurrence = duplicates.get(hash) ?? 0;
			duplicates.set(hash, occurrence + 1);
			plan.push({
				namespace,
				key: `alias/${hash}/${occurrence}`,
				path: `/aliases/${index}`,
				fields: {
					value,
					kind: "source-alias",
					origin: "variant",
					primaryForLanguage: false,
					languageTag: null,
				},
			});
		}
	return plan;
}

export function planVndbSupportingSemantics(record: VndbSupportingRecord): VndbSemanticPlan {
	const plan: VndbSemanticPlan =
		typeof record.id === "string" ? planVndbSemantics(record) : { facts: [], relations: [] };
	const add = (
		key: string,
		value: string | number | boolean | null,
		path: string,
		kind: VndbSemanticFact["kind"],
		namespace: VndbSemanticFact["namespace"] = "source.vndb.qualifier",
	) => plan.facts.push({ key, value, path, kind, namespace });
	if (record.objectType === "tag" || record.objectType === "trait") {
		for (const field of ["searchable", "applicable"] as const)
			if (record[field] !== undefined)
				add(`taxonomy-${field}`, record[field], `/${field}`, "boolean");
		if (record.defaultspoil !== undefined)
			add("taxonomy-default-spoiler", record.defaultspoil, "/defaultspoil", "number");
		if (record.objectType === "tag" && record.category !== undefined)
			add("taxonomy-category", record.category, "/category", "string");
		if (record.objectType === "trait") {
			if (record.sexual !== undefined) add("taxonomy-sexual", record.sexual, "/sexual", "boolean");
			if (record.gorder !== undefined)
				add("taxonomy-group-order", record.gorder, "/gorder", "number");
			if (record.group_id && record.group_id !== record.id)
				plan.relations.push({
					key: "has-trait-group",
					path: "/group_id",
					spoiler: 0,
					qualifiers: [],
					participants: [
						{
							role: "concept",
							target: {
								owner: "reference",
								shape: "concept",
								objectType: "trait",
								externalId: record.group_id,
								path: "/group_id",
								name: record.group_name,
							},
						},
					],
				});
		}
	}
	if (record.objectType === "quote") {
		add("quotation-text", record.quote, "/quote", "string", "catalog.metadata");
		const participants: VndbSemanticRelation["participants"] = [
			{
				role: "content",
				target: {
					owner: "software",
					shape: "content",
					objectType: "vn",
					externalId: record.vn.id,
					path: "/vn/id",
				},
			},
		];
		if (record.character)
			participants.push({
				role: "character",
				target: {
					owner: "entity",
					shape: "character",
					objectType: "character",
					externalId: record.character.id,
					path: "/character/id",
				},
			});
		plan.relations.push({
			key: "quotation-context",
			path: "/vn",
			spoiler: 0,
			qualifiers: [],
			participants,
		});
	}
	if (record.objectType === "drm") {
		const properties = {
			disc: "requires-disc-check",
			cdkey: "requires-product-key",
			activate: "requires-online-activation",
			alimit: "limits-activations",
			account: "requires-account",
			online: "requires-continuous-network",
			cloud: "cloud-streamed",
			physical: "requires-physical-token",
		} as const;
		for (const field of Object.keys(properties) as (keyof typeof properties)[])
			add(properties[field], record[field], `/${field}`, "boolean", "catalog.metadata");
	}
	if (
		(record.objectType === "drm" || record.objectType === "engine") &&
		record.description !== undefined
	)
		add(
			record.objectType === "drm" ? "access-mechanism-description" : "engine-description",
			record.description,
			"/description",
			"string",
			"catalog.metadata",
		);

	if (record.objectType === "character")
		for (const value of planVndbCharacterFacts(record)) {
			plan.facts.push({
				namespace: "catalog",
				key: value.key,
				kind: value.valueKind,
				value: value.value,
				path: value.path,
				spoiler: value.spoiler,
			});
		}
	return plan;
}
