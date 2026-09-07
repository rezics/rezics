import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import type { CatalogSourceReceipt } from "./source-observations";
import type { CatalogReference } from "./contracts";
import { VndbCatalogContractSha256, vndbLanguage } from "./vndb";

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const name = z.string().min(1).max(131_072);
const names = z.array(name).max(1024);
const spoiler = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const externalLinks = z
	.array(
		z
			.object({
				url: z.url(),
				label: z.string(),
				name: z.string(),
				id: z.union([z.string(), integer]),
			})
			.passthrough(),
	)
	.max(1024);
const common = {
	name,
	original: name.nullable().optional(),
	description: z.string().nullable().optional(),
	extlinks: externalLinks.optional(),
};
const alias = z
	.object({ aid: integer, name, latin: name.nullable(), ismain: z.boolean() })
	.passthrough();

/** @alpha @remarks Reviewed Kana staff contract. Alias identities are distinct from person identities. */
export const VndbStaffSchema = z
	.object({
		id: z.string().regex(/^s[1-9][0-9]*$/u),
		...common,
		aid: integer,
		ismain: z.boolean(),
		lang: z.string(),
		gender: z.enum(["m", "f"]).nullable().optional(),
		aliases: z.array(alias).min(1).max(1024).optional(),
	})
	.passthrough()
	.superRefine((record, context) => {
		if (!record.aliases) return;
		if (new Set(record.aliases.map((value) => value.aid)).size !== record.aliases.length)
			context.addIssue({
				code: "custom",
				message: "Duplicate staff alias identity",
				path: ["aliases"],
			});
		if (record.aliases.filter((value) => value.ismain).length !== 1)
			context.addIssue({
				code: "custom",
				message: "Staff aliases require one main name",
				path: ["aliases"],
			});
		const selected = record.aliases.find((value) => value.aid === record.aid);
		if (
			!selected ||
			selected.ismain !== record.ismain ||
			(selected.latin ?? selected.name) !== record.name ||
			(record.original !== undefined &&
				(selected.latin === null ? null : selected.name) !== record.original)
		)
			context.addIssue({
				code: "custom",
				message: "Selected staff alias differs from its alias record",
				path: ["aid"],
			});
	});

/** @alpha @remarks Individuals, companies and amateur collectives retain distinct native shapes. */
export const VndbProducerSchema = z
	.object({
		id: z.string().regex(/^p[1-9][0-9]*$/u),
		...common,
		aliases: names.optional(),
		lang: z.string(),
		type: z.enum(["co", "in", "ng"]),
	})
	.passthrough();

const sex = z.enum(["m", "f", "b", "n"]).nullable();
const gender = z.enum(["m", "f", "o", "a"]).nullable();
const birthday = z
	.tuple([integer.min(1).max(12), integer.min(1).max(31)])
	.refine(
		([month, day]) => day <= new Date(Date.UTC(2000, month, 0)).getUTCDate(),
		"Invalid recurring birthday",
	);
const image = z
	.object({
		id: z.string(),
		url: z.url(),
		dims: z.tuple([integer.positive(), integer.positive()]),
		sexual: z.number().min(0).max(2),
		violence: z.number().min(0).max(2),
		votecount: integer,
	})
	.passthrough();

/** @alpha @remarks Explicit null means unknown; omitted Kana fields remain unobserved. */
export const VndbCharacterSchema = z
	.object({
		id: z.string().regex(/^c[1-9][0-9]*$/u),
		...common,
		aliases: names.optional(),
		image: image.nullable().optional(),
		blood_type: z.enum(["a", "b", "ab", "o"]).nullable().optional(),
		height: integer.nullable().optional(),
		weight: integer.nullable().optional(),
		bust: integer.nullable().optional(),
		waist: integer.nullable().optional(),
		hips: integer.nullable().optional(),
		cup: z
			.string()
			.regex(/^(?:AAA|AA|[A-Z])$/u)
			.nullable()
			.optional(),
		age: integer.nullable().optional(),
		birthday: birthday.nullable().optional(),
		sex: z.tuple([sex, sex]).nullable().optional(),
		gender: z.tuple([gender, gender]).nullable().optional(),
		vns: z
			.array(
				z
					.object({
						id: z.string().regex(/^v[1-9][0-9]*$/u),
						spoiler,
						role: z.enum(["main", "primary", "side", "appears"]),
						release: z
							.object({ id: z.string().regex(/^r[1-9][0-9]*$/u) })
							.passthrough()
							.nullable(),
					})
					.passthrough(),
			)
			.max(4096)
			.optional(),
		traits: z
			.array(
				z
					.object({ id: z.string().regex(/^i[1-9][0-9]*$/u), spoiler, lie: z.boolean() })
					.passthrough(),
			)
			.max(4096)
			.optional(),
	})
	.passthrough();

type ScalarFact = {
	key: string;
	valueKind: "number" | "string";
	value: string | number | null;
	path: string;
	spoiler: 0 | 2;
	unit?: string;
	allowedValues?: string[];
	minimum?: number;
	maximum?: number;
};

/** @alpha @remarks Provider-independent measurements and separate apparent/actual identity statements. */
export function planVndbCharacterFacts(input: unknown): ScalarFact[] {
	const value = VndbCharacterSchema.parse(input);
	const facts: ScalarFact[] = [];
	for (const [key, unit] of [
		["height", "cm"],
		["weight", "kg"],
		["bust", "cm"],
		["waist", "cm"],
		["hips", "cm"],
		["age", "year"],
	] as const) {
		if (value[key] !== undefined)
			facts.push({
				key: `character.${key}`,
				valueKind: "number",
				value: value[key],
				unit,
				minimum: 0,
				path: `/${key}`,
				spoiler: 0,
			});
	}
	if (value.blood_type !== undefined)
		facts.push({
			key: "character.blood_type",
			valueKind: "string",
			value: value.blood_type?.toUpperCase() ?? null,
			allowedValues: ["A", "B", "AB", "O"],
			path: "/blood_type",
			spoiler: 0,
		});
	if (value.cup !== undefined)
		facts.push({
			key: "character.cup",
			valueKind: "string",
			value: value.cup,
			allowedValues: ["AAA", "AA", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
			path: "/cup",
			spoiler: 0,
		});
	if (value.birthday !== undefined) {
		facts.push({
			key: "character.birthday_month",
			valueKind: "number",
			value: value.birthday?.[0] ?? null,
			minimum: 1,
			maximum: 12,
			path: value.birthday === null ? "/birthday" : "/birthday/0",
			spoiler: 0,
		});
		facts.push({
			key: "character.birthday_day",
			valueKind: "number",
			value: value.birthday?.[1] ?? null,
			minimum: 1,
			maximum: 31,
			path: value.birthday === null ? "/birthday" : "/birthday/1",
			spoiler: 0,
		});
	}
	const sexes = { m: "male", f: "female", b: "both", n: "sexless" } as const;
	const genders = { m: "male", f: "female", o: "nonbinary", a: "ambiguous" } as const;
	for (const [index, scope] of [
		[0, "apparent"],
		[1, "actual"],
	] as const) {
		if (value.sex !== undefined) {
			const code = value.sex?.[index];
			facts.push({
				key: `character.${scope}_sex`,
				valueKind: "string",
				value: code == null ? null : sexes[code],
				allowedValues: Object.values(sexes),
				path: value.sex === null ? "/sex" : `/sex/${index}`,
				spoiler: index === 0 ? 0 : 2,
			});
		}
		if (value.gender !== undefined) {
			const code = value.gender?.[index];
			facts.push({
				key: `character.${scope}_gender`,
				valueKind: "string",
				value: code == null ? null : genders[code],
				allowedValues: Object.values(genders),
				path: value.gender === null ? "/gender" : `/gender/${index}`,
				spoiler: index === 0 ? 0 : 2,
			});
		}
	}
	return facts;
}

/** @alpha @remarks Exactly one identity per person; each alias keeps its provider alias key and source path. */
export function planVndbStaffNames(input: unknown) {
	const record = VndbStaffSchema.parse(input);
	const languageTag = vndbLanguage(record.lang);
	return record.aliases
		? record.aliases.map((value, position) => ({
				aid: value.aid,
				value: value.name,
				latin: value.latin,
				ismain: value.ismain,
				languageTag,
				path: `/aliases/${position}/name`,
				aliasPath: `/aliases/${position}/aid`,
				latinPath: `/aliases/${position}/latin`,
			}))
		: [
				{
					aid: record.aid,
					value: record.original ?? record.name,
					latin: record.original ? record.name : null,
					ismain: record.ismain,
					languageTag,
					path: record.original ? "/original" : "/name",
					aliasPath: "/aid",
					latinPath: "/name",
				},
			];
}

/** @alpha @remarks Source category mapping is explicit; an individual producer is a person. */
export function vndbProducerShape(type: z.infer<typeof VndbProducerSchema>["type"]) {
	return ({ co: "organization", in: "person", ng: "collective" } as const)[type];
}

type EntityKind = "staff" | "producer" | "character";
type SourceEntity =
	| z.infer<typeof VndbStaffSchema>
	| z.infer<typeof VndbProducerSchema>
	| z.infer<typeof VndbCharacterSchema>;

async function adoptVndbEntity(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	kind: EntityKind,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("VNDB entity projection differs from its archived source bytes");
	if (receipt.contractSha256 !== VndbCatalogContractSha256)
		throw new TypeError("VNDB source contract has not been reviewed for this mapper");
	const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const record: SourceEntity =
		kind === "staff"
			? VndbStaffSchema.parse(input)
			: kind === "producer"
				? VndbProducerSchema.parse(input)
				: VndbCharacterSchema.parse(input);
	if (
		receipt.key.source !== "vndb" ||
		receipt.key.objectType !== kind ||
		receipt.key.externalId !== record.id
	)
		throw new TypeError("VNDB entity identity differs from its archived source key");
	const { recordCatalogSourceDocument } = await import("./source-observations");
	const { inspectExistingSourceBinding } = await import("./source-adoption");
	const { bindCatalogSourceIdentity, acceptCatalogSourceInitialization } = await import(
		"./source-bindings"
	);
	const { createEntity, initializeEntityProfile, resolveEntityShape } = await import("./entities");
	const {
		addCatalogName,
		ensureCatalogDefinition,
		appendCatalogFactNodes,
		beginCatalogFact,
		sealCatalogFact,
		loadCatalogIdentity,
	} = await import("./storage");
	const { bindCatalogNameSourceOccurrence } = await import("./names");
	const { appendVndbSemantics } = await import("./vndb-semantics");
	const { CatalogFactTables } = await import("../database/schema/catalog-facts");
	const { catalogValueNodes } = await import("./value-nodes");
	const document = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(tx, actor, document, `vndb.${kind}.2`);
	if (existing && existing.status !== "initialize_reference") return existing;
	const staff = kind === "staff" ? VndbStaffSchema.parse(record) : null;
	const producer = kind === "producer" ? VndbProducerSchema.parse(record) : null;
	const shape = staff ? "person" : producer ? vndbProducerShape(producer.type) : "character";
	const nativeNames = staff ? planVndbStaffNames(staff) : [];
	const mainAlias = nativeNames.find((value) => value.ismain) ?? nativeNames[0];
	const languageTag = staff
		? vndbLanguage(staff.lang)
		: producer
			? vndbLanguage(producer.lang)
			: null;
	const primaryValue = mainAlias?.value ?? record.original ?? record.name;
	const genderRevisionId = staff?.gender
		? (
				await ensureCatalogDefinition(tx, {
					namespace: "catalog.gender",
					key: staff.gender === "m" ? "male" : "female",
					kind: "vocabulary",
					valueKind: null,
				})
			).revisionId
		: null;
	const created = existing
		? null
		: await createEntity(tx, actor, {
				shape,
				name: { languageTag, value: primaryValue },
				profile: { genderRevisionId },
			});
	let reference: CatalogReference;
	let revision: number;
	if (created) {
		reference = { owner: created.owner, id: created.id };
		revision = created.revision;
	} else if (existing) {
		reference = existing.reference;
		revision = existing.revision;
	} else throw new Error("VNDB entity initialization produced no native target");
	if (reference.owner !== "entity") throw new TypeError("VNDB entity resolved to another owner");
	if (existing) {
		const current = await loadCatalogIdentity(tx, reference, actor, true);
		if (current.shape === "unresolved")
			revision = (await resolveEntityShape(tx, reference, actor, revision, shape)).revision;
		else if (current.shape !== shape)
			throw new TypeError("VNDB endpoint classification differs from the bound entity shape");
		revision = (await initializeEntityProfile(tx, reference, actor, revision, { genderRevisionId }))
			.revision;
	}
	const tables = CatalogFactTables.entity;
	let unusedPrimaryId = created?.nameId;
	const writeName = async (
		value: string,
		path: string,
		language: string | null,
		nameKind: string,
		origin: "original" | "transliteration" | "variant",
		primary: boolean,
	) => {
		let nameId: string;
		let nameRevision = 1;
		if (
			unusedPrimaryId &&
			value === primaryValue &&
			language === languageTag &&
			origin === "original"
		) {
			nameId = unusedPrimaryId;
			unusedPrimaryId = undefined;
		} else {
			const named = await addCatalogName(tx, reference, actor, revision, {
				value,
				languageTag: language,
				kind: nameKind,
				origin,
				primaryForLanguage: primary,
			});
			revision = named.revision;
			nameId = named.id;
			nameRevision = named.nameRevision;
		}
		await tx
			.insert(tables.support)
			.values({
				ownerId: reference.id,
				namedFormId: nameId,
				sourceRecordId: document.record.id,
				snapshotId: document.snapshot.id,
				sourcePath: path,
			});
		return { nameId, nameRevision };
	};
	if (staff) {
		for (const alias of nativeNames) {
			const named = await writeName(
				alias.value,
				alias.path,
				alias.languageTag,
				alias.ismain ? "source-primary" : "source-alias",
				"original",
				alias.ismain,
			);
			await bindCatalogNameSourceOccurrence(tx, reference, actor, {
				namespace: "vndb.staff.alias",
				localKey: String(alias.aid),
				...named,
				sourceRecordId: document.record.id,
				snapshotId: document.snapshot.id,
				sourcePath: alias.aliasPath,
			});
			if (alias.latin)
				await writeName(
					alias.latin,
					alias.latinPath,
					null,
					"source-transliteration",
					"transliteration",
					false,
				);
		}
	} else {
		await writeName(
			record.original ?? record.name,
			record.original ? "/original" : "/name",
			languageTag,
			"source-primary",
			"original",
			true,
		);
		if (record.original && record.name !== record.original)
			await writeName(
				record.name,
				"/name",
				null,
				"source-transliteration",
				"transliteration",
				false,
			);
		const aliases = producer ? producer.aliases : VndbCharacterSchema.parse(record).aliases;
		for (const [index, alias] of (aliases ?? []).entries())
			await writeName(alias, `/aliases/${index}`, null, "source-alias", "variant", false);
	}
	if (created) {
		const [identifier] = await tx
			.insert(tables.identifier)
			.values({
				ownerId: reference.id,
				namespace: `vndb.${kind}`,
				value: record.id,
				normalizedValue: record.id,
			})
			.returning({ id: tables.identifier.id });
		if (!identifier) throw new Error("VNDB identifier insert returned no row");
		await tx
			.insert(tables.support)
			.values({
				ownerId: reference.id,
				identifierId: identifier.id,
				sourceRecordId: document.record.id,
				snapshotId: document.snapshot.id,
				sourcePath: "/id",
			});
	}
	if (kind === "character") {
		for (const fact of planVndbCharacterFacts(record)) {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "catalog",
				key: fact.key,
				kind: "property",
				valueKind: fact.valueKind,
				constraints: {
					nullable: true,
					integer: fact.valueKind === "number",
					minimum: fact.minimum,
					maximum: fact.maximum,
					unit: fact.unit,
					allowedValues: fact.allowedValues,
				},
			});
			const begun = await beginCatalogFact(tx, reference, actor, revision, definition.revisionId, {
				spoiler: fact.spoiler,
			});
			const appended = await appendCatalogFactNodes(
				tx,
				reference,
				actor,
				begun.revision,
				begun.id,
				-1,
				[...catalogValueNodes(fact.value)],
			);
			revision = (
				await sealCatalogFact(
					tx,
					reference,
					actor,
					appended.revision,
					begun.id,
					appended.lastNodePosition,
				)
			).revision;
			await tx
				.insert(tables.support)
				.values({
					ownerId: reference.id,
					factId: begun.id,
					sourceRecordId: document.record.id,
					snapshotId: document.snapshot.id,
					sourcePath: fact.path,
				});
		}
	}
	revision = await appendVndbSemantics(tx, reference, actor, revision, record, document);
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
		});
	return { status: "created" as const, reference, revision, snapshotId: document.snapshot.id };
}

/** @alpha @remarks Initial adoption or untouched reference completion. Subsequent snapshots require review. */
export async function adoptVndbStaff(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	return adoptVndbEntity(tx, actor, receipt, bytes, "staff");
}
/** @alpha @remarks Producer classification is preserved while source identity remains an external binding. */
export async function adoptVndbProducer(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	return adoptVndbEntity(tx, actor, receipt, bytes, "producer");
}
/** @alpha @remarks Character facts retain explicit unknowns, recurring birthdays and spoiler-qualified identity. */
export async function adoptVndbCharacter(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	return adoptVndbEntity(tx, actor, receipt, bytes, "character");
}
