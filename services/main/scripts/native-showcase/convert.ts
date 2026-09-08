import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { z } from "zod";
import {
	PackObjectSchema,
	PackRelationsSchema,
	PackStructuresSchema,
	IdLedgerSchema,
	RightsRecordsSchema,
	PackManifestSchema,
} from "../../src/services/content-pack/schemas";
import type { PackObject } from "../../src/services/content-pack/contracts";

const recordSchema = z.record(z.string(), z.unknown());
const record = (value: unknown) => recordSchema.parse(value);
const array = (value: unknown) => z.array(z.unknown()).parse(value);
const text = (value: unknown) => z.string().parse(value);
const textOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);
const legacyObject = z
	.object({
		sourceKey: z.string(),
		unit: z.object({
			kind: z.enum([
				"book",
				"media",
				"software",
				"release",
				"series",
				"entity",
				"label",
				"tag",
				"zone",
				"zone_page",
				"collection",
				"post",
				"realm",
				"audio",
				"video",
			]),
			status: z.enum(["draft", "published", "archived"]),
			visibility: z.enum(["private", "public", "unlisted"]),
			contentRating: z.enum(["general", "r15", "r18", "r18g"]),
			aiDisclosure: z.string(),
			license: z.unknown(),
			moderationStatus: z.string(),
			postTargetingLocked: z.boolean(),
		}),
		localizations: z.array(recordSchema).min(1),
	})
	.catchall(z.unknown());
type LegacyObject = z.infer<typeof legacyObject>;
const objectNames = [
	"realm.json",
	"zones.json",
	"zone-pages.json",
	"series.json",
	"books.json",
	"media.json",
	"software.json",
	"releases.json",
	"video.json",
	"audio.json",
	"entities.json",
	"tags.json",
	"posts.json",
	"labels.json",
	"collections.json",
] as const;
const outputNames = {
	publishing: "publishing.json",
	music: "music.json",
	program: "program.json",
	software: "software.json",
	entity: "entities.json",
	grouping: "groupings.json",
	reference: "references.json",
	distribution: "distributions.json",
	post: "posts.json",
	realm: "realm.json",
	zone: "zones.json",
	label: "labels.json",
	tag: "tags.json",
	collection: "collections.json",
	audio: "audio.json",
	video: "video.json",
};
function hash(value: unknown) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function deterministicId(key: string) {
	const bytes = createHash("sha256")
		.update(`rezics.native-showcase.1\0${key}`)
		.digest()
		.subarray(0, 16);
	bytes[0] = 0x01;
	bytes[1] = 0x9f;
	bytes[2] = 0xff;
	bytes[3] = 0x10;
	bytes[4] = 0;
	bytes[5] = 0;
	bytes[6] = (bytes[6]! & 15) | 0x70;
	bytes[8] = (bytes[8]! & 63) | 0x80;
	const value = bytes.toString("hex");
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
async function json(path: string) {
	return JSON.parse(await readFile(path, "utf8")) as unknown;
}
async function optional(path: string, fallback: unknown) {
	try {
		return await json(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return fallback;
		throw error;
	}
}
async function write(path: string, value: unknown) {
	await mkdir(resolve(path, ".."), { recursive: true });
	await writeFile(path, JSON.stringify(value, null, "\t") + "\n");
}
function within(root: string, path: string) {
	const rel = relative(root, path);
	if (!rel || rel.startsWith("..") || isAbsolute(rel))
		throw new Error("Output path is outside its exact target root");
	return path;
}
function nextVersion(value: unknown) {
	const match = text(value).match(/^(\d+)\.(\d+)\.(\d+)$/u);
	if (!match) throw new Error("Expected RomVer pack version");
	return Number(match[1]) < 1 ? "1.0.0" : `${match[1]}.${Number(match[2]) + 1}.0`;
}
function name(object: LegacyObject) {
	const first = object.localizations.find((entry) => typeof entry.title === "string");
	if (!first) throw new Error(`No source name for ${object.sourceKey}`);
	return { languageTag: text(first.language), value: text(first.title) };
}
function copyStructure(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(copyStructure);
	if (value === null || typeof value !== "object") return value;
	const input = record(value),
		output: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(input)) output[key] = copyStructure(item);
	if (input.kind !== null && typeof input.kind === "object" && !Array.isArray(input.kind)) {
		const constraint = record(input.kind);
		if (
			Array.isArray(constraint.in) &&
			constraint.in.every((item) => item === "book" || item === "media")
		) {
			delete output.kind;
			output.owner = {
				in: [...new Set(constraint.in.map((item) => (item === "book" ? "publishing" : "program")))],
			};
		}
	}
	return output;
}
function bodyTexts(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(bodyTexts);
	if (!value || typeof value !== "object") return [];
	return Object.entries(record(value)).flatMap(([key, value]) =>
		key === "text" && typeof value === "string" ? [value] : bodyTexts(value),
	);
}
const target = (owner: string, shape: string) => [{ owner, shapes: [shape] }];
function definition(
	key: string,
	kind: "class" | "property" | "predicate" | "role",
	owner: string,
	shape: string,
	valueKind: string | null = null,
	unit?: string,
) {
	return {
		namespace: "showcase.catalog",
		key: `${owner}.${shape}.${key}`,
		kind,
		valueKind,
		constraints: {
			targets: target(owner, shape),
			...(unit ? { unit, integer: true, minimum: 1 } : {}),
		},
	};
}
function date(value: unknown) {
	const raw = text(value),
		parts = raw.split("-").map(Number);
	if (parts.length !== 3 || parts.some((part) => !Number.isSafeInteger(part)))
		throw new Error("Expected source calendar date");
	return { year: parts[0]!, month: parts[1]!, day: parts[2]!, text: raw };
}

export async function convertShowcasePack(sourceRoot: string, outputRoot: string, packId: string) {
	if (!/^[a-z0-9][a-z0-9-]*$/u.test(packId)) throw new Error("Invalid pack ID");
	const source = join(sourceRoot, "packs", packId),
		output = within(outputRoot, join(outputRoot, "packs", packId));
	const ids = IdLedgerSchema.parse(await json(join(source, "ids.json"))),
		rights = RightsRecordsSchema.parse(await json(join(source, "rights.json")));
	const sourceManifest = PackManifestSchema.parse(await json(join(source, "pack.json")));
	const originals: LegacyObject[] = [];
	const chapterOutputs = new Map<string, string>();
	for (const filename of objectNames)
		originals.push(
			...array(await optional(join(source, "content", filename), [])).map((entry) =>
				legacyObject.parse(entry),
			),
		);
	const chapterFiles = await readdir(join(source, "content", "chapters")).catch(
		(error: unknown) => {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
			throw error;
		},
	);

	for (const filename of chapterFiles.sort()) {
		if (!filename.endsWith(".json")) throw new Error("Unexpected chapter file");
		const object = legacyObject.parse(await json(join(source, "content", "chapters", filename)));
		originals.push(object);
		chapterOutputs.set(object.sourceKey, filename);
	}

	const sourceRelations = record(await optional(join(source, "content", "relations.json"), {}));
	const sourceStructures = array(
		await optional(join(source, "content", "structures.json"), []),
	).map(record);
	const oldByKey = new Map(originals.map((object) => [object.sourceKey, object]));
	const variantParents = new Map(
		array(sourceRelations.unitVariants ?? []).map((value) => {
			const row = record(value);
			return [text(row.variantUnitSourceKey), text(row.mainUnitSourceKey)] as const;
		}),
	);
	const authored = new Set(
		sourceStructures
			.filter((structure) => structure.kind === "book.contents" && packId !== "toaru-core")
			.map((structure) => text(structure.ownerUnitSourceKey)),
	);
	const objects: PackObject[] = [],
		byKey = new Map<string, PackObject>(),
		report: Record<string, unknown>[] = [];
	const facts: unknown[] = [],
		relations: unknown[] = [],
		publishingComponents: unknown[] = [],
		softwareComponents: unknown[] = [];
	const textKeys = new Set<string>(),
		workKeys = new Map<string, string>();
	function addFact(
		key: string,
		ownerKey: string,
		value: unknown,
		unit?: string,
		sourceEvidence?: unknown,
	) {
		const owner = byKey.get(ownerKey);
		if (!owner) throw new Error(`Missing converted fact owner ${ownerKey}`);
		const valueKind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
		facts.push({
			sourceKey: `${ownerKey}:fact:${key}`,
			ownerSourceKey: ownerKey,
			definition: definition(
				key,
				"property",
				owner.identity.owner,
				owner.identity.shape,
				valueKind,
				unit,
			),
			value,
			...(sourceEvidence ? { sourceEvidence } : {}),
		});
	}
	function addWork(original: LegacyObject, sharedKey?: string) {
		const key = sharedKey ?? `${original.sourceKey}:work`;
		if (byKey.has(key)) return key;
		ids.units[key] = deterministicId(`${packId}:${key}`);
		const { kind: _sourceKind, ...workMetadata } = original.unit;
		const value = PackObjectSchema.parse({
			sourceKey: key,
			identity: {
				...workMetadata,
				owner: "publishing",
				shape: "work",
				aiDisclosure: "unknown",
				postTargetingLocked: false,
			},
			native: { kind: "publishing_work", name: name(original) },
			import: original.import,
			localizations: original.localizations.map((localization) => ({
				language: localization.language,
				title: localization.title,
			})),
		});
		objects.push(value);
		byKey.set(key, value);
		const prior = rights.find((entry) => entry.sourceKey === original.sourceKey);
		if (prior)
			rights.push({ ...prior, sourceKey: key, fieldRights: undefined, payloadSha256: hash(value) });
		return key;
	}
	function coverage(
		ownerKey: string,
		targetKey: string,
		kind: "text_work" | "publication_work",
		position: number,
	) {
		const targetId = ids.units[targetKey];
		if (!targetId) throw new Error("Missing coverage target");
		publishingComponents.push({
			ownerSourceKey: ownerKey,
			key: targetId,
			value: { kind, targetId, position },
		});
	}
	for (const original of originals) {
		const kind = original.unit.kind,
			copy: Record<string, unknown> = {
				...original,
				localizations: copyStructure(original.localizations),
			};
		for (const old of [
			"unit",
			"book",
			"media",
			"software",
			"release",
			"series",
			"entity",
			"entityMeasurements",
		])
			delete copy[old];
		let owner: string = kind,
			shape: string = kind,
			native: unknown;
		if (kind === "book") {
			owner = "publishing";
			const detail = record(original.book);
			if (packId === "toaru-core") {
				shape = "publication";
				native = {
					kind: "publication",
					name: name(original),
					pageCount: numberOrNull(detail.pageCount),
				};
				if (detail.isbn13)
					copy.nativeIdentifiers = [{ namespace: "isbn", value: text(detail.isbn13) }];
				if (detail.publicationDate) {
					const released = date(detail.publicationDate);
					publishingComponents.push({
						ownerSourceKey: original.sourceKey,
						key: deterministicId(`${original.sourceKey}:publication-event`),
						value: {
							kind: "event",
							date: { year: released.year, month: released.month, day: released.day },
							dateText: released.text,
						},
					});
				}
			} else if (
				packId === "hongloumeng" ||
				authored.has(original.sourceKey) ||
				original.structureSourceKey
			) {
				shape = "text_version";
				textKeys.add(original.sourceKey);
				const declared = array(original.contentLanguageSupport ?? [])
					.map(record)
					.find((entry) => Array.isArray(entry.channels) && entry.channels.includes("text"));
				let languageTag = textOrNull(declared?.languageTag);
				if (languageTag === null && authored.has(original.sourceKey)) {
					const structure = sourceStructures.find(
						(item) => item.ownerUnitSourceKey === original.sourceKey,
					);
					const node = structure
						? array(structure.nodes)
								.map(record)
								.find((node) => oldByKey.get(text(node.contentUnitSourceKey))?.unit.kind === "post")
						: undefined;
					const chapter = node ? oldByKey.get(text(node.contentUnitSourceKey)) : undefined;
					languageTag = chapter
						? textOrNull(chapter.localizations.find((entry) => entry.content)?.language)
						: null;
				}
				native = { kind: "text_version", name: name(original), languageTag };
			} else {
				shape = "work";
				native = { kind: "publishing_work", name: name(original) };
			}
		} else if (kind === "media") {
			owner = "program";
			shape = "program";
			const detail = record(original.media);
			native = {
				kind: "program",
				name: name(original),
				structure: {
					shape: "program",
					fields: {
						declaredMainEpisodeCount: numberOrNull(detail.episodeCount),
						declaredTotalEpisodeCount: numberOrNull(detail.episodeCount),
					},
				},
			};
		} else if (kind === "software") {
			owner = "software";
			const parent = variantParents.get(original.sourceKey),
				detail = record(original.software);
			if (parent) {
				shape = "version";
				const supports = array(original.contentLanguageSupport ?? [])
					.map(record)
					.filter((entry) => Array.isArray(entry.channels) && entry.channels.includes("text"));
				native = {
					kind: "software_version",
					name: name(original),
					content: { owner: "software", id: ids.units[parent] },
					details: {
						kind: "variant",
						versionLabel: textOrNull(detail.versionLabel),
						languageTag: supports.length === 1 ? textOrNull(supports[0]?.languageTag) : null,
						distinguishingEvidence: text(detail.versionLabel),
					},
				};
			} else {
				shape = "content";
				native = {
					kind: "software_content",
					name: name(original),
					visualNovel: packId === "vndb-v11",
				};
			}
		} else if (kind === "release") {
			owner = "software";
			shape = "release";
			const detail = record(original.release);
			native = {
				kind: "software_release",
				name: name(original),
				details: detail.releasedOn ? { date: date(detail.releasedOn) } : {},
			};
			const parentKey = text(detail.parentUnitSourceKey),
				contentKey = variantParents.get(parentKey) ?? parentKey;
			softwareComponents.push({
				ownerSourceKey: original.sourceKey,
				values: [
					{
						kind: "content",
						contentId: ids.units[contentKey],
						versionId: variantParents.has(parentKey) ? ids.units[parentKey] : null,
					},
				],
			});
		} else if (kind === "series") {
			owner = "grouping";
			shape = "grouping";
			native = { kind: "grouping", name: name(original) };
			const sourceKind = text(record(original.series).kind);
			const key =
				sourceKind === "book_series"
					? "publishing_series"
					: sourceKind === "media_series"
						? "program_series"
						: sourceKind;
			copy.groupingClasses = [definition(key, "class", owner, shape)];
		} else if (kind === "entity") {
			owner = "entity";
			shape = text(record(original.entity).kind);
			native = { kind: "entity", shape, name: name(original) };
		} else if (kind === "zone_page") {
			owner = "post";
			shape = "page";
		} else if (kind === "post") shape = text(record(original.post).kind);
		const { kind: ignored, ...metadata } = original.unit;
		copy.identity = {
			...metadata,
			owner,
			shape,
			...(native ? { aiDisclosure: "unknown", postTargetingLocked: false } : {}),
		};
		if (native) copy.native = native;
		if (copy.zone) {
			const zone = record(copy.zone);
			if (zone.filterUnitKind) {
				zone.filterOwner = zone.filterUnitKind === "book" ? "publishing" : "program";
				delete zone.filterUnitKind;
			}
			copy.zone = zone;
		}
		if (copy.compiledZone) copy.compiledZone = copyStructure(copy.compiledZone);
		const converted = PackObjectSchema.parse(copy);
		if (hash(bodyTexts(original.localizations)) !== hash(bodyTexts(converted.localizations)))
			throw new Error(`Authored prose changed: ${original.sourceKey}`);
		objects.push(converted);
		byKey.set(original.sourceKey, converted);
		report.push({
			sourceKey: original.sourceKey,
			id: ids.units[original.sourceKey],
			sourceKind: kind,
			owner,
			shape,
			sourceSha256: hash(original),
			nativeSha256: hash(converted),
			...(kind === "entity"
				? {
						sourceVerifiedFlag: record(original.entity).verified,
						verificationDecision: "Unscoped source verification is not canonical authority",
					}
				: {}),
			authoredTextSha256: hash(bodyTexts(converted.localizations)),
		});
	}
	for (const original of originals) {
		const key = original.sourceKey;
		if (original.unit.kind === "book") {
			if (textKeys.has(key)) {
				let workKey: string;
				if (packId === "hongloumeng") {
					const canonical = oldByKey.get("hongloumeng:book:canonical");
					if (!canonical) throw new Error("Missing Red Chamber text root");
					workKey = addWork(canonical, "hongloumeng:publishing:work");
				} else workKey = addWork(original);
				workKeys.set(key, workKey);
				coverage(key, workKey, "text_work", 0);
			} else if (packId === "toaru-core" && !key.includes(":omnibus:")) {
				const workKey = addWork(original);
				workKeys.set(key, workKey);
				coverage(key, workKey, "publication_work", 0);
			}
			const detail = record(original.book);
			if (detail.releaseStatus) addFact("declared_completion_state", key, detail.releaseStatus);
		} else if (original.unit.kind === "media") {
			for (const [keyName, value] of Object.entries(record(original.media)))
				if (!["episodeCount"].includes(keyName))
					addFact(
						`program_${keyName.replace(/[A-Z]/gu, (c) => `_${c.toLowerCase()}`)}`,
						key,
						value,
					);
		} else if (original.unit.kind === "software") {
			const detail = record(original.software);
			if (detail.releaseDate) addFact("first_release_date", key, detail.releaseDate);
		}
		if (original.entityMeasurements)
			for (const [index, item] of array(original.entityMeasurements).entries()) {
				const measurement = record(item);
				if (measurement.contextUnitSourceKey !== null)
					throw new Error(
						"Contextual source measurement requires an explicit qualifier conversion decision",
					);
				for (const [field, value] of Object.entries(measurement))
					if (field.endsWith("Millimetres") || field === "weightGrams")
						addFact(
							`${field.replace(/[A-Z]/gu, (c) => `_${c.toLowerCase()}`)}_${index}`,
							key,
							value,
							field === "weightGrams" ? "g" : "mm",
							{
								sourceUrl: measurement.sourceUrl,
								sourceImportedAt: measurement.sourceImportedAt,
								sourceProvenance: measurement.sourceProvenance,
							},
						);
			}
	}
	const structures: unknown[] = [];
	for (const structure of sourceStructures) {
		if (packId === "toaru-core" && structure.kind === "book.contents") {
			const ownerKey = text(structure.ownerUnitSourceKey);
			for (const [index, item] of array(structure.nodes).entries()) {
				const node = record(item),
					targetKey = workKeys.get(text(node.contentUnitSourceKey));
				if (!targetKey) throw new Error("Omnibus has an unresolved source volume Work");
				coverage(ownerKey, targetKey, "publication_work", index);
				if (ids.nodes) delete ids.nodes[text(node.sourceKey)];
			}
			if (ids.structures) delete ids.structures[text(structure.sourceKey)];
			continue;
		}
		structures.push(copyStructure(structure));
	}

	const groupDateDefinition = definition(
		"member_release_date",
		"property",
		"grouping",
		"grouping",
		"string",
	);
	for (const item of array(sourceRelations.seriesReleases ?? [])) {
		const row = record(item),
			ownerKey = text(row.seriesSourceKey),
			targetKey = text(row.releaseUnitSourceKey),
			factKey = `${ownerKey}:member:${targetKey}:released-on`;
		const qualifier =
			row.releasedOn === null || row.releasedOn === undefined
				? []
				: [{ factSourceKey: factKey, definition: groupDateDefinition }];
		if (qualifier.length)
			facts.push({
				sourceKey: factKey,
				ownerSourceKey: ownerKey,
				definition: groupDateDefinition,
				value: text(row.releasedOn),
			});
		relations.push({
			sourceSourceKey: ownerKey,
			targetSourceKey: targetKey,
			definition: definition("group_member", "predicate", "grouping", "grouping"),
			roleDefinition: {
				...definition("group_member_target", "role", "grouping", "grouping"),
				constraints: {
					targets: [
						{ owner: "publishing", shapes: ["work", "text_version", "publication"] },
						{ owner: "program", shapes: ["program"] },
					],
				},
			},
			order: { profileKey: "reading-order", position: text(row.position) },
			qualifiers: qualifier,
			qualifierDefinitions: [groupDateDefinition],
		});
	}

	const newRelations: Record<string, unknown> = {
		...sourceRelations,
		catalogFacts: facts,
		catalogRelations: relations,
		publishingComponents,
		softwareComponents,
	};
	newRelations.credits = array(sourceRelations.credits ?? []).map((entry) => {
		const row = record(entry);
		if (row.creditedUnitSourceKey !== undefined) {
			row.creditedEntitySourceKey = row.creditedUnitSourceKey;
			delete row.creditedUnitSourceKey;
		}
		return row;
	});
	delete newRelations.unitVariants;
	delete newRelations.seriesReleases;
	const parsedRelations = PackRelationsSchema.parse(newRelations),
		parsedStructures = PackStructuresSchema.parse(structures);
	const byFile = new Map<string, PackObject[]>();
	for (const object of objects) {
		const chapterFile = chapterOutputs.get(object.sourceKey);
		if (chapterFile) {
			await write(within(output, join(output, "content", "chapters", chapterFile)), object);
			continue;
		}
		if (!(object.identity.owner in outputNames)) throw new Error("Unsupported output owner");
		const entry = Object.entries(outputNames).find(([owner]) => owner === object.identity.owner);
		if (!entry) throw new Error("Output document missing");
		const list = byFile.get(entry[1]) ?? [];
		list.push(object);
		byFile.set(entry[1], list);
	}
	for (const filename of new Set([...objectNames, ...Object.values(outputNames)])) {
		const path = within(output, join(output, "content", filename));
		if (byFile.has(filename)) await write(path, byFile.get(filename));
		else await rm(path, { force: true });
	}
	await write(join(output, "ids.json"), ids);
	await write(join(output, "rights.json"), rights);
	await write(join(output, "content", "relations.json"), parsedRelations);
	await write(join(output, "content", "structures.json"), parsedStructures);
	const counts = Object.fromEntries(
		[...new Set(objects.map((object) => `${object.identity.owner}.${object.identity.shape}`))]
			.sort()
			.map((key) => [
				key,
				objects.filter((object) => `${object.identity.owner}.${object.identity.shape}` === key)
					.length,
			]),
	);
	await write(join(output, "pack.json"), {
		...sourceManifest,
		version: nextVersion(sourceManifest.version),
		counts,
	});
	return {
		packId,
		sourceObjects: originals.length,
		nativeObjects: objects.length,
		addedObjects: objects.length - originals.length,
		counts,
		nativeFacts: facts.length,
		nativeRelations: relations.length,
		publishingComponents: publishingComponents.length,
		softwareComponents: softwareComponents.length,
		structuresBefore: sourceStructures.length,
		structuresAfter: parsedStructures.length,
		objects: report,
		addedIdentities: objects
			.filter((object) => !oldByKey.has(object.sourceKey))
			.map((object) => ({
				sourceKey: object.sourceKey,
				id: ids.units[object.sourceKey],
				owner: object.identity.owner,
				shape: object.identity.shape,
			})),
	};
}

export async function convertShowcase(source: string, output: string) {
	const sourceRoot = resolve(source),
		outputRoot = resolve(output);
	const descendant = relative(sourceRoot, outputRoot);
	if (!descendant || (!descendant.startsWith("..") && !isAbsolute(descendant)))
		throw new Error("Conversion requires a distinct isolated output checkout");
	const packs = (await readdir(join(sourceRoot, "packs"), { withFileTypes: true }))
		.filter((item) => item.isDirectory())
		.map((item) => item.name)
		.sort();
	const report = [];
	for (const pack of packs) report.push(await convertShowcasePack(sourceRoot, outputRoot, pack));
	await write(join(outputRoot, "native-conversion-report.json"), {
		format: "native-showcase-conversion.1",
		sourceRepository: "rezics-showcase-packs",
		sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim(),
		sourceDirty:
			execFileSync("git", ["-C", sourceRoot, "status", "--porcelain"], { encoding: "utf8" }).trim()
				.length > 0,
		packs: report,
	});
	return report.map(({ objects, addedIdentities, ...summary }) => summary);
}
