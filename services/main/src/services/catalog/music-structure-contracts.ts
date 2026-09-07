import { z } from "zod";

const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableId = z.uuid().nullable();
const text = z.string().max(131_072).nullable();
const owner = { release_id: z.uuid() };
const identified = { ...owner, id: z.uuid() };

/** @alpha Complete native component rows; SQL history uses the same column spellings. */
export const MusicComponentSchemas = {
	music_release: z.strictObject({
		id: z.uuid(),
		identity_shape: z.literal("release"),
		release_group_id: nullableId,
		artist_credit_id: nullableId,
		status_revision_id: nullableId,
		packaging_revision_id: nullableId,
		language_tag: text,
		script_code: text,
		barcode: text,
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
		language_tag: text,
		script_code: text,
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
]);
export type MusicComponentName = z.infer<typeof MusicComponentNameSchema>;

export const MusicComponentKeys: Record<MusicComponentName, readonly string[]> = {
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
};

const locator = {
	component: MusicComponentNameSchema,
	componentKey: z.string().min(1).max(512),
	expectedRevisionId: z.uuid().nullable(),
};
/** @alpha Put values are unproved until the selected component schema parses them. */
export const MusicComponentMutationSchema = z.discriminatedUnion("action", [
	z.strictObject({ ...locator, action: z.literal("put"), value: z.unknown() }),
	z.strictObject({ ...locator, action: z.literal("remove") }),
	z.strictObject({ ...locator, action: z.literal("restore"), historyId: z.uuid() }),
]);
export const MusicComponentBatchSchema = z
	.array(MusicComponentMutationSchema)
	.min(1)
	.max(128)
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
				(parts.length !== MusicComponentKeys[operation.component].length ||
					parts.some((part) => !z.uuid().safeParse(part).success))
			)
				ctx.addIssue({ code: "custom", message: "Invalid component key" });
		}
	});
export type MusicComponentMutation = z.input<typeof MusicComponentMutationSchema>;

/** @alpha Exact immutable heads needed to reverse a native application without overwriting corrections. */
export const MusicComponentChangeSchema = z.strictObject({
	component: MusicComponentNameSchema,
	componentKey: z.string().min(1).max(512),
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
