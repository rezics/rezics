import { MUSIC_SOURCE_COMPONENT_LIMIT } from "../database/schema/catalog-source-limits";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableId = z.uuid().nullable();
const text = z.string().max(131_072).nullable();
const language = z.string().min(1).max(255).transform(canonicalizeContentLanguageTag).nullable();
const script = z
	.string()
	.regex(/^[A-Z][a-z]{3}$/u)
	.nullable();
const owner = { release_id: z.uuid() };
const identified = { ...owner, id: z.uuid() };

/** @alpha Complete native component rows; SQL history uses the same column spellings. */
export const MusicComponentSchemas = {
	music_work: z.strictObject({
		id: z.uuid(),
		identity_shape: z.literal("work"),
		type_revision_id: nullableId,
	}),
	music_recording: z.strictObject({
		id: z.uuid(),
		identity_shape: z.literal("recording"),
		artist_credit_id: nullableId,
		length_milliseconds: integer.nullable(),
		video: z.boolean().nullable(),
	}),
	music_release_group: z.strictObject({
		id: z.uuid(),
		identity_shape: z.literal("release_group"),
		artist_credit_id: nullableId,
		primary_type_revision_id: nullableId,
	}),
	music_work_language: z.strictObject({ work_id: z.uuid(), language_tag: language.unwrap() }),
	music_release_group_secondary_type: z.strictObject({
		release_group_id: z.uuid(),
		type_revision_id: z.uuid(),
	}),
	music_release: z.strictObject({
		id: z.uuid(),
		identity_shape: z.literal("release"),
		release_group_id: nullableId,
		artist_credit_id: nullableId,
		status_revision_id: nullableId,
		packaging_revision_id: nullableId,
		language_tag: language,
		script_code: script,
		barcode: z.string().max(512).nullable(),
	}),
	music_medium: z.strictObject({
		...identified,
		position: integer,
		name: text,
		format_revision_id: nullableId,
		source_track_count: integer.nullable(),
	}),
	music_track_occurrence: z.strictObject({
		...identified,
		medium_id: z.uuid(),
		position: integer,
		number: z.string().max(131_072),
		name: text,
		recording_id: nullableId,
		artist_credit_id: nullableId,
		length_milliseconds: integer.nullable(),
		is_data_track: z.boolean().nullable(),
	}),
	music_release_label: z.strictObject({
		...identified,
		label_id: nullableId,
		catalog_number: text,
	}),
	music_release_event: z.strictObject({
		...identified,
		area_id: nullableId,
		date_year: z.number().int().nullable(),
		date_month: z.number().int().min(1).max(12).nullable(),
		date_day: z.number().int().min(1).max(31).nullable(),
		date_text: text,
	}),
	music_release_presentation: z.strictObject({
		...identified,
		name: text,
		artist_credit_id: nullableId,
		language_tag: language,
		script_code: script,
		type_revision_id: nullableId,
		comment: text,
	}),
	music_medium_presentation: z.strictObject({
		...identified,
		release_presentation_id: z.uuid(),
		medium_id: z.uuid(),
		name: text,
	}),
	music_track_presentation: z.strictObject({
		...owner,
		medium_presentation_id: z.uuid(),
		medium_id: z.uuid(),
		track_id: z.uuid(),
		alternative_track_id: z.uuid(),
	}),
	music_medium_toc: z.strictObject({ ...owner, medium_id: z.uuid(), toc_id: z.uuid() }),
	music_medium_attribute: z
		.strictObject({
			...owner,
			medium_id: z.uuid(),
			id: z.uuid(),
			definition_revision_id: z.uuid(),
			value_revision_id: nullableId,
			text_value: text,
		})
		.refine(
			(value) => (value.value_revision_id !== null) !== (value.text_value !== null),
			"Attribute requires exactly one native value",
		),
	music_track_identifier: z.strictObject({
		...owner,
		track_id: z.uuid(),
		namespace: z.string().min(1).max(96),
		value: z.string().min(1).max(512),
	}),
	music_medium_identifier: z.strictObject({
		...owner,
		medium_id: z.uuid(),
		namespace: z.string().min(1).max(96),
		value: z.string().min(1).max(512),
	}),
} as const;

export const MusicComponentNameSchema = z.enum([
	"music_work",
	"music_recording",
	"music_release_group",
	"music_work_language",
	"music_release_group_secondary_type",
	"music_release",
	"music_track_identifier",
	"music_medium_identifier",
	"music_medium",
	"music_track_occurrence",
	"music_release_label",
	"music_release_event",
	"music_release_presentation",
	"music_medium_presentation",
	"music_track_presentation",
	"music_medium_toc",
	"music_medium_attribute",
]);
export type MusicComponentName = z.infer<typeof MusicComponentNameSchema>;

export const MusicComponentKeys: Record<MusicComponentName, readonly string[]> = {
	music_work: ["id"],
	music_recording: ["id"],
	music_release_group: ["id"],
	music_work_language: ["language_tag"],
	music_release_group_secondary_type: ["type_revision_id"],
	music_release: ["id"],
	music_track_identifier: ["track_id", "namespace", "value"],
	music_medium_identifier: ["medium_id", "namespace", "value"],
	music_medium: ["id"],
	music_track_occurrence: ["id"],
	music_release_label: ["id"],
	music_release_event: ["id"],
	music_release_presentation: ["id"],
	music_medium_presentation: ["id"],
	music_track_presentation: ["medium_presentation_id", "track_id"],
	music_medium_toc: ["medium_id", "toc_id"],
	music_medium_attribute: ["medium_id", "id"],
};

/** @internal Escaped key tokens prevent collisions between namespace/value pairs containing separators. */
export function musicComponentKey(component: MusicComponentName, row: Record<string, unknown>) {
	return MusicComponentKeys[component]
		.map((key) => z.string().parse(row[key]).replaceAll("~", "~0").replaceAll("/", "~1"))
		.join("/");
}

/** @internal Component storage ownership is independent of its source object family. */
export function musicComponentOwner(component: MusicComponentName) {
	switch (component) {
		case "music_work":
			return { column: "id", shape: "work" } as const;
		case "music_work_language":
			return { column: "work_id", shape: "work" } as const;
		case "music_recording":
			return { column: "id", shape: "recording" } as const;
		case "music_release_group":
			return { column: "id", shape: "release_group" } as const;
		case "music_release_group_secondary_type":
			return { column: "release_group_id", shape: "release_group" } as const;
		case "music_release":
			return { column: "id", shape: "release" } as const;
		default:
			return { column: "release_id", shape: "release" } as const;
	}
}

const locator = {
	component: MusicComponentNameSchema,
	componentKey: z
		.string()
		.min(1)
		.max(1536)
		.refine((value) => Buffer.byteLength(value) <= 1536),
	expectedRevisionId: z.uuid().nullable(),
};
/** @alpha Put values are unproved until the selected component schema parses them. */
export const MusicComponentMutationSchema = z.discriminatedUnion("action", [
	z.strictObject({ ...locator, action: z.literal("put"), value: z.unknown() }),
	z.strictObject({ ...locator, action: z.literal("remove") }),
	z.strictObject({ ...locator, action: z.literal("restore"), historyId: z.uuid() }),
]);
const musicComponentBatchSchema = (limit: number) => z
	.array(MusicComponentMutationSchema)
	.min(1)
	.max(limit)
	.superRefine((operations, ctx) => {
		const keys = new Set<string>();
		for (const operation of operations) {
			const key = `${operation.component}/${operation.componentKey}`;
			if (keys.has(key))
				ctx.addIssue({ code: "custom", message: "A component may change only once per batch" });
			keys.add(key);
			const parts = operation.componentKey.split("/");
			if (
				!operation.component.endsWith("_identifier") &&
				operation.component !== "music_work_language" &&
				(parts.length !== MusicComponentKeys[operation.component].length ||
					parts.some((part) => !z.uuid().safeParse(part).success))
			)
				ctx.addIssue({ code: "custom", message: "Invalid component key" });
		}
	});
export const MusicComponentBatchSchema = musicComponentBatchSchema(128);
/** @internal One fenced background publication; never accepted by the manual command API. */
export const MusicSourceComponentBatchSchema = musicComponentBatchSchema(MUSIC_SOURCE_COMPONENT_LIMIT);
export type MusicComponentMutation = z.input<typeof MusicComponentMutationSchema>;

/** @alpha Exact immutable heads needed to reverse a native application without overwriting corrections. */
export const MusicComponentChangeSchema = z.strictObject({
	component: MusicComponentNameSchema,
	componentKey: z
		.string()
		.min(1)
		.max(1536)
		.refine((value) => Buffer.byteLength(value) <= 1536),
	beforeRevisionId: z.uuid().nullable(),
	afterRevisionId: z.uuid(),
});
export type MusicComponentChange = z.infer<typeof MusicComponentChangeSchema>;

export function musicComponentCompensation(
	changes: readonly MusicComponentChange[],
): MusicComponentMutation[] {
	return [...z.array(MusicComponentChangeSchema).min(1).max(128).parse(changes)]
		.reverse()
		.map((change) => ({
			component: change.component,
			componentKey: change.componentKey,
			expectedRevisionId: change.afterRevisionId,
			...(change.beforeRevisionId
				? { action: "restore" as const, historyId: change.beforeRevisionId }
				: { action: "remove" as const }),
		}));
}
