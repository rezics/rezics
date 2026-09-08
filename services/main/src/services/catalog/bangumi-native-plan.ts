import { createHash } from "node:crypto";
import { z } from "zod";
import {
	BangumiSubjectContractSha256,
	BangumiSubjectSchema,
	bangumiDate,
	type BangumiWikiEntrySchema,
} from "./bangumi";
import { BangumiApiContractSha256, BangumiArchiveContractSha256 } from "./bangumi-contracts";
import {
	BangumiArchiveSubjectSchema,
	BangumiArchivePersonSchema,
	BangumiArchiveCharacterSchema,
	BangumiArchiveEpisodeSchema,
	BangumiPersonSchema,
	BangumiCharacterSchema,
	BangumiEpisodeSchema,
	parseBangumiWiki,
} from "./bangumi-records";
import type { CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNamePlan } from "./source-name-delta";
import { prepareStructureSourceProjection } from "./structure-source-contracts";
import type { CatalogSourceFactDescriptor } from "./source-fact-delta";

/** Descriptions are native assertions; provider ratings, popularity and moderation state remain observations. @internal */
export function planBangumiNativeFacts(record: BangumiNativeRecord): CatalogSourceFactDescriptor[] {
	const value = record.value;
	const description =
		"summary" in value ? value.summary : "description" in value ? value.description : value.desc;
	const path = "summary" in value ? "/summary" : "description" in value ? "/description" : "/desc";
	return description
		? [
				{
					identity: "description",
					path,
					namespace: "catalog",
					key: "description",
					value: description,
					kind: "string",
				},
			]
		: [];
}

/** Offline inputs are checked against the exact reviewed contract and archived content digest. @internal */
export function prepareBangumiNativeRecord(receipt: CatalogSourceReceipt, bytes: Uint8Array) {
	if (
		receipt.key.source !== "bangumi" ||
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Bangumi native input differs from its immutable receipt");
	const archive = receipt.contractSha256 === BangumiArchiveContractSha256;
	const kind = receipt.key.objectType;
	if (
		!archive &&
		receipt.contractSha256 !==
			(kind === "subject" ? BangumiSubjectContractSha256 : BangumiApiContractSha256)
	)
		throw new TypeError("Unreviewed Bangumi native contract");
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const record = (() => {
		switch (kind) {
			case "subject":
				return {
					kind,
					value: archive ? BangumiArchiveSubjectSchema.parse(raw) : BangumiSubjectSchema.parse(raw),
				} as const;
			case "person":
				return {
					kind,
					value: archive ? BangumiArchivePersonSchema.parse(raw) : BangumiPersonSchema.parse(raw),
				} as const;
			case "character":
				return {
					kind,
					value: archive
						? BangumiArchiveCharacterSchema.parse(raw)
						: BangumiCharacterSchema.parse(raw),
				} as const;
			case "episode":
				return {
					kind,
					value: archive ? BangumiArchiveEpisodeSchema.parse(raw) : BangumiEpisodeSchema.parse(raw),
				} as const;
			default:
				throw new TypeError(
					"Bangumi record family requires its reviewed relation or collection writer",
				);
		}
	})();
	if (String(record.value.id) !== receipt.key.externalId)
		throw new TypeError("Bangumi native source identity differs");
	return { ...record, archive };
}
export type BangumiNativeRecord = ReturnType<typeof prepareBangumiNativeRecord>;

/** Repeated aliases retain their own ordered paths; correspondence uses complete values, never alias positions. @internal */
export function planBangumiNativeNames(record: BangumiNativeRecord): CatalogSourceNamePlan[] {
	const names: CatalogSourceNamePlan[] = [];
	const primary =
		record.value.name ||
		("name_cn" in record.value ? record.value.name_cn : "") ||
		(record.kind === "episode" ? String(record.value.sort) : "");
	if (!primary) throw new TypeError("Unnamed Bangumi identity requires reviewed native naming");
	names.push({
		path: record.value.name
			? "/name"
			: "name_cn" in record.value && record.value.name_cn
				? "/name_cn"
				: "/sort",
		match: "path",
		value: {
			value: primary,
			kind: "source-primary",
			languageTag: record.value.name
				? null
				: "name_cn" in record.value && record.value.name_cn
					? "zh"
					: null,
		},
	});
	if (record.value.name && "name_cn" in record.value && record.value.name_cn)
		names.push({
			path: "/name_cn",
			match: "path",
			value: { value: record.value.name_cn, kind: "source-translated", languageTag: "zh" },
		});
	const wiki = "infobox" in record.value ? record.value.infobox : null;
	let entries: z.output<typeof BangumiWikiEntrySchema>[] = [];
	if (typeof wiki === "string") {
		const parsed = parseBangumiWiki(wiki);
		if (parsed.status === "parsed") entries = parsed.entries;
	} else if (wiki) entries = wiki;
	for (const [index, entry] of entries.entries()) {
		if (
			!["别名", "別名", "简体中文名", "簡體中文名", "繁体中文名", "繁體中文名"].includes(entry.key)
		)
			continue;
		const languageTag = ["简体中文名", "簡體中文名"].includes(entry.key)
			? "zh-Hans"
			: ["繁体中文名", "繁體中文名"].includes(entry.key)
				? "zh-Hant"
				: null;
		const values =
			typeof entry.value === "string"
				? [{ value: entry.value, path: `/infobox/${index}/value` }]
				: entry.value.map((item, position) => ({
						value: item.v,
						path: `/infobox/${index}/value/${position}/v`,
					}));
		for (const item of values)
			if (item.value)
				names.push({
					path: item.path,
					match: "value",
					value: {
						value: item.value,
						kind: languageTag ? "source-translated" : "source-alias",
						languageTag,
					},
				});
	}
	if (names.length > 128) throw new RangeError("Bangumi named forms require staged application");
	return names;
}

/** Archive omits API-only episode counts and parsed duration; absent fields are never projected as null. @internal */
export function planBangumiProgramProjection(record: BangumiNativeRecord, programId?: string) {
	if (record.kind === "subject" && [2, 6].includes(record.value.type)) {
		const fields =
			"eps" in record.value
				? {
						declaredMainEpisodeCount: record.value.eps,
						declaredTotalEpisodeCount: record.value.total_episodes,
					}
				: {};
		return prepareStructureSourceProjection(
			"program",
			{ shape: "program", fields },
			Object.keys(fields),
		);
	}
	if (record.kind !== "episode") return null;
	const value = record.value;
	const fields = {
		programId: z.uuid().parse(programId),
		sortNumber: value.sort,
		discNumber: value.disc >= 0 ? value.disc : null,
		durationText: value.duration,
		date: bangumiDate(value.airdate) ?? { year: null, month: null, day: null },
		dateText: value.airdate,
		...("ep" in value ? { episodeNumber: value.ep ?? null } : {}),
		...("duration_seconds" in value
			? {
					lengthMilliseconds:
						value.duration_seconds &&
						value.duration_seconds <= Math.floor(Number.MAX_SAFE_INTEGER / 1000)
							? value.duration_seconds * 1000
							: null,
				}
			: {}),
	};
	return prepareStructureSourceProjection(
		"program",
		{ shape: "episode", fields },
		Object.keys(fields),
	);
}
