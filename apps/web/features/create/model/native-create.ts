import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import {
	CatalogReferenceSchema,
	type CatalogOwner,
	type CatalogReference,
} from "@rezics/reference";
import type { CreateCatalogResourceBody } from "@rezics/openapi-tanstack-query";
import type { EntityPickerValue } from "@rezics/ui";

export const NativeCreateKindValues = [
	"publishing_work",
	"text_version",
	"publication",
	"serialization",
	"musical_work",
	"recording",
	"release_group",
	"music_release",
	"software_content",
	"software_version",
	"software_release",
	"program",
	"entity",
	"reference",
	"grouping",
	"distribution",
] as const satisfies readonly CreateCatalogResourceBody["kind"][];
export type NativeCreateKind = (typeof NativeCreateKindValues)[number];
export const NativeCreateContractIsExact: Exclude<
	CreateCatalogResourceBody["kind"],
	NativeCreateKind
> extends never
	? true
	: false = true;
export const NativeCreateOwnerByKind = {
	publishing_work: "publishing",
	text_version: "publishing",
	publication: "publishing",
	serialization: "publishing",
	musical_work: "music",
	recording: "music",
	release_group: "music",
	music_release: "music",
	software_content: "software",
	software_version: "software",
	software_release: "software",
	program: "program",
	entity: "entity",
	reference: "reference",
	grouping: "grouping",
	distribution: "distribution",
} as const satisfies Record<NativeCreateKind, CatalogOwner>;
export const NativeCreateShapeByKind = {
	publishing_work: "work",
	text_version: "text_version",
	publication: "publication",
	serialization: "serialization",
	musical_work: "work",
	recording: "recording",
	release_group: "release_group",
	music_release: "release",
	software_content: "content",
	software_version: "version",
	software_release: "release",
	program: "program",
	entity: "person",
	reference: "concept",
	grouping: "grouping",
	distribution: "package",
} as const satisfies Record<NativeCreateKind, string>;
export const NativeCreateKindsByOwner = {
	publishing: ["publishing_work", "text_version", "publication", "serialization"],
	music: ["musical_work", "recording", "release_group", "music_release"],
	program: ["program"],
	software: ["software_content", "software_version", "software_release"],
	entity: ["entity"],
	reference: ["reference"],
	grouping: ["grouping"],
	distribution: ["distribution"],
} as const satisfies Record<CatalogOwner, readonly NativeCreateKind[]>;
export const NativeProgramShapes = [
	"program",
	"season",
	"program_version",
	"episode",
] as const satisfies readonly Extract<
	CreateCatalogResourceBody,
	{ kind: "program" }
>["structure"]["shape"][];
export const NativeEntityShapes = [
	"person",
	"organization",
	"character",
	"label",
	"collective",
	"unresolved",
	"service_actor",
] as const satisfies readonly Extract<CreateCatalogResourceBody, { kind: "entity" }>["shape"][];
export const NativeReferenceShapes = [
	"concept",
	"web_resource",
	"area",
	"instrument",
	"place",
	"event",
] as const satisfies readonly Extract<
	CreateCatalogResourceBody,
	{ kind: "reference" }
>["profile"]["shape"][];
export const NativeVersionKinds = [
	"revision",
	"translation",
	"localization",
	"port",
	"variant",
] as const satisfies readonly Extract<
	CreateCatalogResourceBody,
	{ kind: "software_version" }
>["details"]["kind"][];
export const NativeDevelopmentStates = [
	"unknown",
	"finished",
	"in_development",
	"cancelled",
] as const;
export const NativeTruthValues = ["unknown", "yes", "no"] as const;
export const NativeCreateFields = {
	name: "",
	nameLanguage: "",
	textLanguage: "",
	pageCount: "",
	paginationText: "",
	duration: "",
	number: "",
	episodeNumber: "",
	mainEpisodes: "",
	totalEpisodes: "",
	versionLabel: "",
	evidence: "",
	url: "",
	originalLanguage: "",
	description: "",
	year: "",
	month: "",
	day: "",
	dateText: "",
	address: "",
	latitude: "",
	longitude: "",
	localTime: "",
	setlist: "",
};
export type NativeCreateField = keyof typeof NativeCreateFields;
export type NativeCreateReferenceField =
	| "content"
	| "textVersion"
	| "releaseGroup"
	| "program"
	| "season"
	| "area"
	| "place";
export type NativeCreateSelection = {
	readonly reference: CatalogReference;
	readonly shape: string;
	readonly label: string;
};
export interface NativeCreateDraft {
	readonly kind: NativeCreateKind;
	readonly fields: typeof NativeCreateFields;
	readonly references: Partial<Record<NativeCreateReferenceField, NativeCreateSelection>>;
	readonly programShape: (typeof NativeProgramShapes)[number];
	readonly entityShape: (typeof NativeEntityShapes)[number];
	readonly referenceShape: (typeof NativeReferenceShapes)[number];
	readonly versionKind: (typeof NativeVersionKinds)[number];
	readonly development: (typeof NativeDevelopmentStates)[number];
	readonly recordingVideo: (typeof NativeTruthValues)[number];
	readonly visualNovel: boolean;
}
export function isNativeCreateKind(value: string): value is NativeCreateKind {
	return NativeCreateKindValues.some((kind) => kind === value);
}
export function createNativeCreateDraft(kind: NativeCreateKind, name = ""): NativeCreateDraft {
	return {
		kind,
		fields: { ...NativeCreateFields, name },
		references: {},
		programShape: "program",
		entityShape: "person",
		referenceShape: "concept",
		versionKind: "revision",
		development: "unknown",
		recordingVideo: "unknown",
		visualNovel: false,
	};
}
export function nativeCreateSelection(
	value: EntityPickerValue,
	owner: CatalogOwner,
	shapes: readonly string[],
): NativeCreateSelection | undefined {
	const parsed = CatalogReferenceSchema.safeParse({ owner: value.owner, id: value.id });
	return parsed.success &&
		parsed.data.owner === owner &&
		value.shape !== undefined &&
		shapes.includes(value.shape)
		? { reference: parsed.data, shape: value.shape, label: value.label }
		: undefined;
}
export type NativeCreateErrorCode =
	| "required"
	| "language"
	| "number"
	| "date"
	| "url"
	| "reference"
	| "coordinates"
	| "time";
export type NativeCreateResult =
	| { readonly ok: true; readonly body: CreateCatalogResourceBody }
	| {
			readonly ok: false;
			readonly code: NativeCreateErrorCode;
			readonly field: NativeCreateField | NativeCreateReferenceField;
	  };
class NativeCreateInputError extends Error {
	constructor(
		readonly code: NativeCreateErrorCode,
		readonly field: NativeCreateField | NativeCreateReferenceField,
	) {
		super(code);
	}
}
function required(value: string, field: NativeCreateField) {
	if (!value.trim()) throw new NativeCreateInputError("required", field);
	return value.trim();
}
function optional(value: string) {
	return value.trim() || null;
}
function language(value: string, field: NativeCreateField) {
	if (!value.trim()) return null;
	try {
		return canonicalizeContentLanguageTag(value.trim());
	} catch {
		throw new NativeCreateInputError("language", field);
	}
}
function numeric(
	value: string,
	field: NativeCreateField,
	{
		integer = true,
		min = 0,
		max = Number.MAX_SAFE_INTEGER,
	}: { integer?: boolean; min?: number; max?: number } = {},
) {
	if (!value.trim()) return null;
	if (!/^-?\d+(?:\.\d+)?$/u.test(value.trim())) throw new NativeCreateInputError("number", field);
	const number = Number(value);
	if (
		!Number.isFinite(number) ||
		(integer && !Number.isSafeInteger(number)) ||
		number < min ||
		number > max
	)
		throw new NativeCreateInputError("number", field);
	return number;
}
function partialDate(fields: typeof NativeCreateFields) {
	const year = numeric(fields.year, "year", { min: -2147483648, max: 2147483647 }),
		month = numeric(fields.month, "month", { min: 1, max: 12 }),
		day = numeric(fields.day, "day", { min: 1, max: 31 });
	if (month !== null && day !== null) {
		const leap = year === null || year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
		const maximum = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
		if (day > maximum) throw new NativeCreateInputError("date", "day");
	}
	return { year, month, day, text: optional(fields.dateText) };
}
function selected(
	draft: NativeCreateDraft,
	field: NativeCreateReferenceField,
	owner: CatalogOwner,
	shape: string,
	mandatory = false,
) {
	const value = draft.references[field];
	if (!value) {
		if (mandatory) throw new NativeCreateInputError("reference", field);
		return undefined;
	}
	const reference = CatalogReferenceSchema.safeParse(value.reference);
	if (!reference.success || reference.data.owner !== owner || value.shape !== shape)
		throw new NativeCreateInputError("reference", field);
	return reference.data;
}
function request(draft: NativeCreateDraft): CreateCatalogResourceBody {
	const f = draft.fields,
		name = {
			value: required(f.name, "name"),
			languageTag: language(f.nameLanguage, "nameLanguage"),
		};
	switch (draft.kind) {
		case "publishing_work":
		case "musical_work":
		case "release_group":
		case "grouping":
		case "distribution":
			return { kind: draft.kind, name };
		case "text_version":
			return { kind: draft.kind, name, languageTag: language(f.textLanguage, "textLanguage") };
		case "publication":
			return {
				kind: draft.kind,
				name,
				pageCount: numeric(f.pageCount, "pageCount"),
				paginationText: optional(f.paginationText),
			};
		case "serialization":
			return {
				kind: draft.kind,
				name,
				textVersionId: selected(draft, "textVersion", "publishing", "text_version")?.id ?? null,
			};
		case "recording":
			return {
				kind: draft.kind,
				name,
				lengthMilliseconds: numeric(f.duration, "duration"),
				video: draft.recordingVideo === "unknown" ? null : draft.recordingVideo === "yes",
			};
		case "music_release":
			return {
				kind: draft.kind,
				name,
				releaseGroup: selected(draft, "releaseGroup", "music", "release_group") ?? undefined,
				languageTag: language(f.textLanguage, "textLanguage"),
			};
		case "software_content":
			return {
				kind: draft.kind,
				name,
				...(draft.visualNovel ? { visualNovel: true } : {}),
				details: {
					originalLanguageTag: language(f.originalLanguage, "originalLanguage"),
					developmentStatus: draft.development === "unknown" ? null : draft.development,
					description: optional(f.description),
				},
			};
		case "software_version": {
			const content = selected(draft, "content", "software", "content", true);
			if (!content) throw new NativeCreateInputError("reference", "content");
			return {
				kind: draft.kind,
				name,
				content,
				details: {
					kind: draft.versionKind,
					versionLabel: optional(f.versionLabel),
					languageTag: language(f.textLanguage, "textLanguage"),
					distinguishingEvidence: required(f.evidence, "evidence"),
				},
			};
		}
		case "software_release":
			return {
				kind: draft.kind,
				name,
				details: { date: partialDate(f), notes: optional(f.description) },
			};
		case "entity":
			return {
				kind: draft.kind,
				name,
				shape: draft.entityShape,
				profile: { areaId: selected(draft, "area", "reference", "area")?.id ?? null },
			};
		case "program": {
			const programId =
				draft.programShape === "program"
					? null
					: (selected(draft, "program", "program", "program")?.id ?? null);
			switch (draft.programShape) {
				case "program":
					return {
						kind: draft.kind,
						name,
						structure: {
							shape: "program",
							fields: {
								declaredMainEpisodeCount: numeric(f.mainEpisodes, "mainEpisodes"),
								declaredTotalEpisodeCount: numeric(f.totalEpisodes, "totalEpisodes"),
							},
						},
					};
				case "season":
					return {
						kind: draft.kind,
						name,
						structure: { shape: "season", fields: { programId, number: optional(f.number) } },
					};
				case "program_version":
					return {
						kind: draft.kind,
						name,
						structure: {
							shape: "program_version",
							fields: { programId, lengthMilliseconds: numeric(f.duration, "duration") },
						},
					};
				case "episode": {
					const seasonId = selected(draft, "season", "program", "season")?.id ?? null;
					if (seasonId && !programId) throw new NativeCreateInputError("reference", "program");
					const { text, ...date } = partialDate(f);
					return {
						kind: draft.kind,
						name,
						structure: {
							shape: "episode",
							fields: {
								programId,
								seasonId,
								episodeNumber: numeric(f.episodeNumber, "episodeNumber", {
									integer: false,
									min: -Number.MAX_SAFE_INTEGER,
								}),
								lengthMilliseconds: numeric(f.duration, "duration"),
								date,
								dateText: text,
							},
						},
					};
				}
			}
		}
		case "reference": {
			switch (draft.referenceShape) {
				case "concept":
				case "instrument":
					return { kind: draft.kind, name, profile: { shape: draft.referenceShape } };
				case "web_resource": {
					const value = required(f.url, "url");
					let url: URL;
					try {
						url = new URL(value);
					} catch {
						throw new NativeCreateInputError("url", "url");
					}
					if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
						throw new NativeCreateInputError("url", "url");
					return { kind: draft.kind, name, profile: { shape: "web_resource", url: url.href } };
				}
				case "area":
					return { kind: draft.kind, name, profile: { shape: "area" } };
				case "place": {
					const latitude = numeric(f.latitude, "latitude", { integer: false, min: -90, max: 90 }),
						longitude = numeric(f.longitude, "longitude", { integer: false, min: -180, max: 180 });
					if ((latitude === null) !== (longitude === null))
						throw new NativeCreateInputError("coordinates", "latitude");
					return {
						kind: draft.kind,
						name,
						profile: {
							shape: "place",
							areaId: selected(draft, "area", "reference", "area")?.id ?? null,
							address: optional(f.address),
							latitude,
							longitude,
						},
					};
				}
				case "event": {
					const localTime = optional(f.localTime);
					if (
						localTime &&
						!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/u.test(localTime)
					)
						throw new NativeCreateInputError("time", "localTime");
					return {
						kind: draft.kind,
						name,
						profile: {
							shape: "event",
							placeId: selected(draft, "place", "reference", "place")?.id ?? null,
							begin: Object.values(partialDate(f)).some((value) => value !== null)
								? partialDate(f)
								: null,
							localTime,
							setlist: optional(f.setlist),
						},
					};
				}
			}
		}
	}
}
/** Each returned body is one official native command; hidden form fields never leak into another shape. */
export function buildNativeCreateRequest(draft: NativeCreateDraft): NativeCreateResult {
	try {
		return { ok: true, body: request(draft) };
	} catch (error) {
		if (error instanceof NativeCreateInputError)
			return { ok: false, code: error.code, field: error.field };
		throw error;
	}
}
