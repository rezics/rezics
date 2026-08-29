import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { type ZodType, type output, z } from "zod";

import type { IdLedger, LoadedPack, PackObject, PackRelations, RightsRecord } from "./contracts";
import { assertContentPackDocuments } from "./documents";
import { ContentPackInvalid } from "./errors";
import {
	IdLedgerSchema,
	PackBindingsSchema,
	PackIdSchema,
	PackManifestSchema,
	PackObjectSchema,
	PackRelationsSchema,
	PackStructuresSchema,
	RightsRecordsSchema,
	SourceLockSchema,
} from "./schemas";

const ObjectDocumentNames = [
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
const KnownContentDocumentNames: ReadonlySet<string> = new Set([
	...ObjectDocumentNames,
	"relations.json",
	"structures.json",
]);
const KnownRootDocumentNames: ReadonlySet<string> = new Set([
	"pack.json",
	"ids.json",
	"rights.json",
	"sources.lock.json",
	"bindings.json",
]);
const EmptyRelations: PackRelations = {
	unitVariants: [],
	credits: [],
	subjects: [],
	seriesReleases: [],
	collectionItems: [],
	unitTags: [],
	guideNodes: [],
	tagRelations: [],
	tagExpressions: [],
	tagExpressionInferenceRules: [],
	tagPaths: [],
	tagPathSenses: [],
	tagPathApplications: [],
	realmUnits: [],
	slugs: [],
};

export async function listPackIds(packsRoot: string): Promise<string[]> {
	const entries = await readdir(join(packsRoot, "packs"), { withFileTypes: true });
	const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	for (const id of ids)
		if (!PackIdSchema.safeParse(id).success)
			throw new ContentPackInvalid(`Invalid content pack directory name: ${id}`);
	return ids.sort();
}

export async function loadPack(packsRoot: string, packId: string): Promise<LoadedPack> {
	const parsedPackId = PackIdSchema.safeParse(packId);
	if (!parsedPackId.success) throw new ContentPackInvalid(`Invalid content pack ID: ${packId}`);
	const safePackId = parsedPackId.data;
	const packDir = join(packsRoot, "packs", safePackId);
	await assertKnownRootDocuments(packDir);
	const manifest = await readJson(join(packDir, "pack.json"), PackManifestSchema);
	if (manifest.id !== safePackId)
		throw new ContentPackInvalid(
			`pack.json id ${manifest.id} does not match directory ${safePackId}`,
		);
	const ids = await readJson(join(packDir, "ids.json"), IdLedgerSchema);
	if (Object.keys(ids.units).length === 0)
		throw new ContentPackInvalid(`${safePackId} ids.json has no units`);
	const rights = await readJson(join(packDir, "rights.json"), RightsRecordsSchema);
	const sourceLock = await readJson(join(packDir, "sources.lock.json"), SourceLockSchema);
	const bindings = await readOptionalJson(join(packDir, "bindings.json"), PackBindingsSchema, []);
	const contentDir = join(packDir, "content");
	await assertKnownContentDocuments(contentDir);
	const objects = await readAllObjects(contentDir);
	assertFieldRightsTargets(rights, objects);
	const relations = await readOptionalJson(
		join(contentDir, "relations.json"),
		PackRelationsSchema,
		EmptyRelations,
	);
	assertPackReferences(ids, objects, relations);
	const structures = await readOptionalJson(
		join(contentDir, "structures.json"),
		PackStructuresSchema,
		[],
	);
	const checksum = await hashPack(packDir);
	const pack: LoadedPack = {
		packDir,
		manifest,
		checksum,
		ids,
		rights,
		sourceLock,
		bindings,
		objects,
		relations,
		structures,
	};
	assertContentPackDocuments(pack);
	return pack;
}

async function assertKnownRootDocuments(packDir: string): Promise<void> {
	for (const entry of await readdir(packDir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".json") && !KnownRootDocumentNames.has(entry.name))
			throw new ContentPackInvalid(`Unsupported content pack root document: ${entry.name}`);
	}
}

async function assertKnownContentDocuments(contentDir: string): Promise<void> {
	for (const entry of await readdir(contentDir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (entry.name !== "chapters")
				throw new ContentPackInvalid(`Unsupported content pack directory: content/${entry.name}`);
			continue;
		}
		if (!entry.isFile() || !KnownContentDocumentNames.has(entry.name))
			throw new ContentPackInvalid(`Unsupported content pack document: content/${entry.name}`);
	}
}

async function readAllObjects(contentDir: string): Promise<PackObject[]> {
	const objects: PackObject[] = [];
	for (const file of ObjectDocumentNames) {
		const parsed = await readOptionalJson(join(contentDir, file), z.array(PackObjectSchema), []);
		objects.push(...parsed);
	}
	const chapterDir = join(contentDir, "chapters");
	const entries = await readOptionalDirectory(chapterDir);
	if (!entries) return objects;
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json"))
			throw new ContentPackInvalid(`Unsupported chapter document: content/chapters/${entry.name}`);
		objects.push(await readJson(join(chapterDir, entry.name), PackObjectSchema));
	}
	return objects;
}

async function readOptionalDirectory(directory: string) {
	try {
		return await readdir(directory, { encoding: "utf8", withFileTypes: true });
	} catch (error) {
		if (isMissingFile(error)) return undefined;
		throw error;
	}
}

function assertFieldRightsTargets(
	rights: readonly RightsRecord[],
	objects: readonly PackObject[],
): void {
	const objectsBySourceKey = new Map(objects.map((object) => [object.sourceKey, object] as const));
	for (const record of rights) {
		if (!record.fieldRights) continue;
		const object = objectsBySourceKey.get(record.sourceKey);
		if (!object)
			throw new ContentPackInvalid(
				`${record.sourceKey} declares field-scoped rights without a matching content object`,
			);
		for (const field of record.fieldRights)
			if (!hasJsonPointer(object, field.path))
				throw new ContentPackInvalid(
					`${record.sourceKey} field-scoped rights path does not exist: ${field.path}`,
				);
	}
}

function assertPackReferences(
	ids: IdLedger,
	objects: readonly PackObject[],
	relations: PackRelations,
): void {
	const objectsBySourceKey = new Map<string, PackObject>();
	for (const object of objects) {
		if (objectsBySourceKey.has(object.sourceKey))
			throw new ContentPackInvalid(`Duplicate content object source key: ${object.sourceKey}`);
		objectsBySourceKey.set(object.sourceKey, object);
		requireLedgerId(ids.units, object.sourceKey, "Unit");
		if (object.entityMeasurements)
			for (const measurement of object.entityMeasurements)
				if (measurement.contextUnitSourceKey)
					requireLedgerId(ids.units, measurement.contextUnitSourceKey, "measurement context Unit");
		if (object.unit.kind === "tag" && object.tag && "parentSourceKeys" in object.tag)
			for (const parentSourceKey of object.tag.parentSourceKeys) {
				if (parentSourceKey === object.sourceKey)
					throw new ContentPackInvalid(`${object.sourceKey} cannot be its own Tag parent`);
				requireLedgerId(ids.units, parentSourceKey, "parent Tag");
			}
	}
	const unitIdValues = Object.values(ids.units);
	if (new Set(unitIdValues).size !== unitIdValues.length)
		throw new ContentPackInvalid("Unit IDs must be unique within a content pack");

	const directApplicationKeys = new Set<string>();
	for (const relation of relations.unitTags ?? []) {
		requireLedgerId(ids.units, relation.unitSourceKey, "Tag application Unit");
		requireLedgerId(ids.units, relation.tagSourceKey, "applied Tag");
		const tagObject = objectsBySourceKey.get(relation.tagSourceKey);
		if (tagObject && tagObject.unit.kind !== "tag")
			throw new ContentPackInvalid(
				`${relation.tagSourceKey} is not a Tag and cannot appear in unitTags`,
			);
		if (
			tagObject?.unit.kind === "tag" &&
			tagObject.tag &&
			"directlyApplicable" in tagObject.tag &&
			!tagObject.tag.directlyApplicable
		)
			throw new ContentPackInvalid(
				`${relation.tagSourceKey} is not directly applicable and cannot appear in unitTags`,
			);
		const key = JSON.stringify([relation.unitSourceKey, relation.tagSourceKey]);
		if (directApplicationKeys.has(key))
			throw new ContentPackInvalid(`Duplicate direct Tag application: ${key}`);
		directApplicationKeys.add(key);
	}

	const vocabularyNodeSourceKeys = new Set<string>();
	for (const [sourceKey, object] of objectsBySourceKey)
		if (object.unit.kind === "tag") vocabularyNodeSourceKeys.add(sourceKey);
	for (const guide of relations.guideNodes ?? []) {
		if (vocabularyNodeSourceKeys.has(guide.sourceKey))
			throw new ContentPackInvalid(`Duplicate vocabulary-node source key: ${guide.sourceKey}`);
		requireLedgerId(ids.guideNodes ?? {}, guide.sourceKey, "guide node");
		vocabularyNodeSourceKeys.add(guide.sourceKey);
	}

	const relationSourceKeys = new Set<string>();
	const relationIdentityKeys = new Set<string>();
	for (const relation of relations.tagRelations ?? []) {
		if (relationSourceKeys.has(relation.sourceKey))
			throw new ContentPackInvalid(`Duplicate Tag relation source key: ${relation.sourceKey}`);
		requireLedgerId(ids.tagRelations ?? {}, relation.sourceKey, "Tag relation");
		if (!vocabularyNodeSourceKeys.has(relation.parentNodeSourceKey))
			throw new ContentPackInvalid(
				`Unknown parent vocabulary node: ${relation.parentNodeSourceKey}`,
			);
		if (!vocabularyNodeSourceKeys.has(relation.childNodeSourceKey))
			throw new ContentPackInvalid(`Unknown child vocabulary node: ${relation.childNodeSourceKey}`);
		const identity = JSON.stringify([
			relation.parentNodeSourceKey,
			relation.childNodeSourceKey,
			relation.relationKind,
		]);
		if (relationIdentityKeys.has(identity))
			throw new ContentPackInvalid(`Duplicate Tag relation: ${identity}`);
		relationIdentityKeys.add(identity);
		relationSourceKeys.add(relation.sourceKey);
	}

	const expressionsBySourceKey = new Map<
		string,
		NonNullable<PackRelations["tagExpressions"]>[number]
	>();
	const claimKeys = new Set<string>();
	for (const expression of relations.tagExpressions ?? []) {
		if (expressionsBySourceKey.has(expression.sourceKey))
			throw new ContentPackInvalid(`Duplicate Tag Expression source key: ${expression.sourceKey}`);
		requireLedgerId(ids.tagExpressions ?? {}, expression.sourceKey, "Tag Expression");
		if (claimKeys.has(expression.canonicalClaimKey))
			throw new ContentPackInvalid(
				`Duplicate Tag Expression claim key: ${expression.canonicalClaimKey}`,
			);
		claimKeys.add(expression.canonicalClaimKey);
		for (const tagSourceKey of [
			expression.focusTagSourceKey,
			...expression.arguments.map((argument) => argument.tagSourceKey),
			...expression.labelComponents.map((component) => component.tagSourceKey),
			...(expression.groupKey ? [expression.groupKey.tagSourceKey] : []),
		]) {
			const object = objectsBySourceKey.get(tagSourceKey);
			if (!object || object.unit.kind !== "tag")
				throw new ContentPackInvalid(
					`${tagSourceKey} is not a Tag and cannot define a Tag Expression`,
				);
		}
		expressionsBySourceKey.set(expression.sourceKey, expression);
	}
	for (const rule of relations.tagExpressionInferenceRules ?? []) {
		if (!expressionsBySourceKey.has(rule.sourceExpressionSourceKey))
			throw new ContentPackInvalid(
				`Unknown inference source Expression: ${rule.sourceExpressionSourceKey}`,
			);
		if (
			rule.targetExpressionSourceKey &&
			!expressionsBySourceKey.has(rule.targetExpressionSourceKey)
		)
			throw new ContentPackInvalid(
				`Unknown inference target Expression: ${rule.targetExpressionSourceKey}`,
			);
		if (rule.targetTagSourceKey) {
			const target = objectsBySourceKey.get(rule.targetTagSourceKey);
			if (!target || target.unit.kind !== "tag")
				throw new ContentPackInvalid(`Unknown inference target Tag: ${rule.targetTagSourceKey}`);
		}
	}

	const pathsBySourceKey = new Map<string, NonNullable<PackRelations["tagPaths"]>[number]>();
	const definitionKeys = new Set<string>();
	const declaredPathIds = new Set<string>();
	for (const path of relations.tagPaths ?? []) {
		if (pathsBySourceKey.has(path.sourceKey))
			throw new ContentPackInvalid(`Duplicate Tag Path source key: ${path.sourceKey}`);
		pathsBySourceKey.set(path.sourceKey, path);
		const declaredPathId = requireLedgerId(ids.tagPaths ?? {}, path.sourceKey, "Tag Path");
		if (declaredPathIds.has(declaredPathId))
			throw new ContentPackInvalid(`Duplicate declared Tag Path ID: ${declaredPathId}`);
		if (unitIdValues.includes(declaredPathId))
			throw new ContentPackInvalid(
				`Tag Path ID collides with an ordinary Unit ID: ${declaredPathId}`,
			);
		declaredPathIds.add(declaredPathId);
		for (const memberSourceKey of path.memberNodeSourceKeys)
			if (!vocabularyNodeSourceKeys.has(memberSourceKey))
				throw new ContentPackInvalid(`Unknown Tag Path member node: ${memberSourceKey}`);
		for (const relationSourceKey of path.relationSourceKeys)
			if (!relationSourceKeys.has(relationSourceKey))
				throw new ContentPackInvalid(`Unknown Tag Path relation: ${relationSourceKey}`);
		const definitionKey = JSON.stringify([path.memberNodeSourceKeys, path.relationSourceKeys]);
		if (definitionKeys.has(definitionKey))
			throw new ContentPackInvalid(`Duplicate exact Tag Path definition: ${path.sourceKey}`);
		definitionKeys.add(definitionKey);
	}

	const sensesBySourceKey = new Map<string, NonNullable<PackRelations["tagPathSenses"]>[number]>();
	for (const sense of relations.tagPathSenses ?? []) {
		if (sensesBySourceKey.has(sense.sourceKey))
			throw new ContentPackInvalid(`Duplicate Tag Path Sense source key: ${sense.sourceKey}`);
		requireLedgerId(ids.tagPathSenses ?? {}, sense.sourceKey, "Tag Path Sense");
		const path = pathsBySourceKey.get(sense.pathSourceKey);
		const expression = expressionsBySourceKey.get(sense.expressionSourceKey);
		if (!path) throw new ContentPackInvalid(`Unknown Tag Path: ${sense.pathSourceKey}`);
		if (!expression)
			throw new ContentPackInvalid(`Unknown Tag Expression: ${sense.expressionSourceKey}`);
		for (const binding of sense.bindings) {
			if (binding.memberOrdinal >= path.memberNodeSourceKeys.length)
				throw new ContentPackInvalid(`Path Sense ${sense.sourceKey} binds an out-of-range member`);
			if (
				!expression.arguments.some(
					(argument) =>
						argument.role === binding.argumentRole &&
						argument.ordinal === binding.argumentOrdinal &&
						argument.tagSourceKey === path.memberNodeSourceKeys[binding.memberOrdinal],
				)
			)
				throw new ContentPackInvalid(
					`Path Sense ${sense.sourceKey} binding does not match its Expression argument`,
				);
		}
		sensesBySourceKey.set(sense.sourceKey, sense);
	}

	const pathApplicationKeys = new Set<string>();
	for (const application of relations.tagPathApplications ?? []) {
		requireLedgerId(ids.units, application.unitSourceKey, "Tag Path application Unit");
		if (!sensesBySourceKey.has(application.senseSourceKey))
			throw new ContentPackInvalid(
				`Unknown Tag Path Sense source key in application: ${application.senseSourceKey}`,
			);
		const key = JSON.stringify([application.unitSourceKey, application.senseSourceKey]);
		if (pathApplicationKeys.has(key))
			throw new ContentPackInvalid(`Duplicate Tag Path application: ${key}`);
		pathApplicationKeys.add(key);
	}

	const subjectSourceKeys = new Set<string>();
	const subjectIdentityKeys = new Set<string>();
	for (const subject of relations.subjects ?? []) {
		if (subjectSourceKeys.has(subject.sourceKey))
			throw new ContentPackInvalid(
				`Duplicate subject association source key: ${subject.sourceKey}`,
			);
		subjectSourceKeys.add(subject.sourceKey);
		requireLedgerId(ids.subjects ?? {}, subject.sourceKey, "subject association");
		requireLedgerId(ids.units, subject.unitSourceKey, "subject Unit");
		requireLedgerId(ids.units, subject.entitySourceKey, "subject Entity");
		const entityObject = objectsBySourceKey.get(subject.entitySourceKey);
		if (entityObject && entityObject.unit.kind !== "entity")
			throw new ContentPackInvalid(
				`${subject.entitySourceKey} is not an Entity and cannot be a subject association Entity`,
			);
		if (subject.contextPostSourceKey)
			requireLedgerId(ids.units, subject.contextPostSourceKey, "subject context Post");
		const identityKey = JSON.stringify([
			subject.unitSourceKey,
			subject.entitySourceKey,
			subject.role,
		]);
		if (subjectIdentityKeys.has(identityKey))
			throw new ContentPackInvalid(`Duplicate subject association identity: ${identityKey}`);
		subjectIdentityKeys.add(identityKey);
	}
}

function requireLedgerId(
	ledger: Readonly<Record<string, string>>,
	sourceKey: string,
	kind: string,
): string {
	const id = ledger[sourceKey];
	if (!id) throw new ContentPackInvalid(`${kind} ${sourceKey} has no deterministic ID`);
	return id;
}

function hasJsonPointer(root: unknown, pointer: string): boolean {
	let value: unknown = root;
	for (const encodedToken of pointer.slice(1).split("/")) {
		const token = encodedToken.replaceAll("~1", "/").replaceAll("~0", "~");
		if (Array.isArray(value)) {
			if (!/^(?:0|[1-9]\d*)$/.test(token)) return false;
			const index = Number(token);
			if (index >= value.length) return false;
			value = value[index];
			continue;
		}
		if (!value || typeof value !== "object" || !Object.hasOwn(value, token)) return false;
		value = Reflect.get(value, token);
	}
	return true;
}

async function hashPack(packDir: string): Promise<string> {
	const hash = createHash("sha256");
	const rootDocumentNames = (await readdir(packDir, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && KnownRootDocumentNames.has(entry.name))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
	for (const name of rootDocumentNames) {
		hash.update(name);
		hash.update(await readFile(join(packDir, name)));
	}
	const contentDir = join(packDir, "content");
	for (const filePath of await listFilesRecursively(contentDir)) {
		const name = relative(packDir, filePath).replaceAll("\\", "/");
		hash.update(name);
		hash.update(await readFile(filePath));
	}
	return hash.digest("hex");
}

async function listFilesRecursively(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listFilesRecursively(path)));
		else if (entry.isFile()) files.push(path);
	}
	return files.sort((left, right) => left.localeCompare(right));
}

async function readJson<Schema extends ZodType>(
	filePath: string,
	schema: Schema,
): Promise<output<Schema>> {
	const source = await readFile(filePath, "utf8");
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch (error) {
		throw new ContentPackInvalid(
			`${filePath} is not valid JSON${error instanceof Error ? `: ${error.message}` : ""}`,
		);
	}
	const result = schema.safeParse(value);
	if (!result.success)
		throw new ContentPackInvalid(
			`${filePath} does not match the content-pack schema: ${describeIssues(result.error)}`,
		);
	return result.data;
}

async function readOptionalJson<Schema extends ZodType>(
	filePath: string,
	schema: Schema,
	fallback: output<Schema>,
): Promise<output<Schema>> {
	try {
		return await readJson(filePath, schema);
	} catch (error) {
		if (isMissingFile(error)) return fallback;
		throw error;
	}
}

function describeIssues(error: z.ZodError): string {
	return error.issues
		.slice(0, 3)
		.map((issue) => {
			const path = issue.path.length ? ` at ${issue.path.map(String).join(".")}` : "";
			return `${issue.message}${path}`;
		})
		.join("; ");
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
