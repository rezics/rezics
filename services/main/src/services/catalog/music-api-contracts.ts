import { z } from "zod";
import { createSelectSchema } from "drizzle-orm/zod";
import {
	musicRelease,
	musicRecording,
	musicReleaseGroup,
	musicWork,
	musicMedium,
	musicTrackOccurrence,
	musicReleaseCandidate,
	musicCandidateTrack,
	musicReleaseLabel,
	musicReleaseEvent,
} from "../database/schema/catalog-music";
import { CatalogRevisionNumberSchema } from "./name-contracts";
import { MusicComponentNameSchema, MusicComponentBatchSchema } from "./music-structure-contracts";

const revision = CatalogRevisionNumberSchema;
const position = z.number().int().nonnegative().safe();
export const MusicPositionQuerySchema = z.strictObject({
	afterPosition: z.coerce.number().int().min(-1).safe().default(-1),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const MusicMediumSchema = createSelectSchema(musicMedium).extend({
	headId: z.uuid().nullable(),
});
export const MusicTrackSchema = createSelectSchema(musicTrackOccurrence).extend({
	headId: z.uuid().nullable(),
});
export const MusicMediaPageSchema = z.strictObject({
	items: z.array(MusicMediumSchema).max(50),
	nextCursor: position.nullable(),
	revision,
});
export const MusicTrackPageSchema = z.strictObject({
	items: z.array(MusicTrackSchema).max(50),
	nextCursor: position.nullable(),
	revision,
});
const base = {
	id: z.uuid(),
	revision,
	headId: z.uuid().nullable(),
	canEdit: z.boolean(),
	title: z.string().nullable(),
	credit: z.string().nullable(),
};
/** @alpha Native music detail keeps works, recordings, release families, releases and incomplete candidates distinct. */
export const MusicDetailSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		...base,
		kind: z.literal("release"),
		metadata: createSelectSchema(musicRelease).omit({ identityShape: true }),
		media: MusicMediaPageSchema,
		tracks: MusicTrackPageSchema.nullable(),
		labels: z.array(createSelectSchema(musicReleaseLabel)).max(50),
		dates: z.array(createSelectSchema(musicReleaseEvent)).max(50),
	}),
	z.strictObject({
		...base,
		kind: z.literal("recording"),
		metadata: createSelectSchema(musicRecording).omit({ identityShape: true }),
	}),
	z.strictObject({
		...base,
		kind: z.literal("release_group"),
		metadata: createSelectSchema(musicReleaseGroup).omit({ identityShape: true }),
	}),
	z.strictObject({
		...base,
		kind: z.literal("work"),
		metadata: createSelectSchema(musicWork).omit({ identityShape: true }),
		languages: z.array(z.string()).max(50),
	}),
	z.strictObject({
		...base,
		kind: z.literal("release_candidate"),
		metadata: createSelectSchema(musicReleaseCandidate).omit({ identityShape: true }),
		tracks: z.array(createSelectSchema(musicCandidateTrack)).max(50),
	}),
]);
export const MusicAddMediumSchema = z.strictObject({
	expectedRevision: revision,
	position,
	name: z.string().max(131072).nullable().optional(),
	sourceTrackCount: position.nullable().optional(),
});
export const MusicTrackValuesSchema = z.strictObject({
	position,
	number: z.string().max(131072),
	name: z.string().max(131072).nullable(),
	recordingId: z.uuid().nullable(),
	artistCreditId: z.uuid().nullable(),
	lengthMilliseconds: position.nullable(),
	isDataTrack: z.boolean().nullable(),
});
export const MusicAddTrackSchema = z.strictObject({
	expectedRevision: revision,
	value: MusicTrackValuesSchema,
});
export const MusicEditTrackSchema = z.strictObject({
	expectedRevision: revision,
	expectedHeadId: z.uuid(),
	value: MusicTrackValuesSchema.partial()
		.extend({ mediumId: z.uuid().optional() })
		.refine(
			(value) => Object.values(value).some((entry) => entry !== undefined),
			"No track changes supplied",
		),
});
export const MusicEditMediumSchema = z.strictObject({
	expectedRevision: revision,
	expectedHeadId: z.uuid(),
	value: z
		.strictObject({
			position: position.optional(),
			name: z.string().max(131072).nullable().optional(),
			formatRevisionId: z.uuid().nullable().optional(),
			sourceTrackCount: position.nullable().optional(),
		})
		.refine(
			(value) => Object.values(value).some((entry) => entry !== undefined),
			"No medium changes supplied",
		),
});
export const MusicStructuralMutationSchema = z.strictObject({
	expectedRevision: revision,
	operations: MusicComponentBatchSchema,
});
export const MusicStructuralResultSchema = z.strictObject({
	revision,
	changes: z
		.array(
			z.strictObject({
				component: MusicComponentNameSchema,
				componentKey: z.string(),
				beforeRevisionId: z.uuid().nullable(),
				afterRevisionId: z.uuid(),
			}),
		)
		.max(128),
});
export const MusicHistoryQuerySchema = z.strictObject({
	component: MusicComponentNameSchema,
	componentKey: z.string().min(1).max(1536),
	afterId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const MusicHistoryPageSchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				id: z.uuid(),
				component: MusicComponentNameSchema,
				componentKey: z.string(),
				componentSequence: revision,
				ownerRevision: revision,
				operation: z.enum(["INSERT", "UPDATE", "DELETE"]),
				value: z.record(z.string(), z.unknown()),
				recordedAt: z.iso.datetime(),
				restorable: z.boolean(),
			}),
		)
		.max(50),
	nextCursor: z.uuid().nullable(),
});
export const MusicRestoreSchema = z.strictObject({
	expectedRevision: revision,
	component: MusicComponentNameSchema,
	componentKey: z.string().min(1).max(1536),
	expectedHeadId: z.uuid(),
	historyId: z.uuid(),
});
const hasChanges = (value: Record<string, unknown>) =>
	Object.values(value).some((entry) => entry !== undefined);
const nullableId = z.uuid().nullable().optional();
const header = { expectedRevision: revision, expectedHeadId: z.uuid() };
export const MusicHeaderPatchSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		...header,
		kind: z.literal("release"),
		value: z
			.strictObject({
				barcode: z.string().max(512).nullable().optional(),
				languageTag: z.string().max(255).nullable().optional(),
				scriptCode: z
					.string()
					.regex(/^[A-Z][a-z]{3}$/u)
					.nullable()
					.optional(),
				releaseGroupId: nullableId,
				artistCreditId: nullableId,
				statusRevisionId: nullableId,
				packagingRevisionId: nullableId,
			})
			.refine(hasChanges, "No release changes supplied"),
	}),
	z.strictObject({
		...header,
		kind: z.literal("recording"),
		value: z
			.strictObject({
				lengthMilliseconds: position.nullable().optional(),
				video: z.boolean().nullable().optional(),
				artistCreditId: nullableId,
			})
			.refine(hasChanges, "No recording changes supplied"),
	}),
	z.strictObject({
		...header,
		kind: z.literal("work"),
		value: z
			.strictObject({ typeRevisionId: nullableId })
			.refine(hasChanges, "No work changes supplied"),
	}),
	z.strictObject({
		...header,
		kind: z.literal("release_group"),
		value: z
			.strictObject({ primaryTypeRevisionId: nullableId, artistCreditId: nullableId })
			.refine(hasChanges, "No release family changes supplied"),
	}),
]);
export const MusicDeleteSchema = z.strictObject(header);
export const MusicStructureQuerySchema = z.strictObject({
	component: MusicComponentNameSchema,
	afterKey: z.string().min(1).max(1536).optional(),
	limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const MusicStructurePageSchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				component: MusicComponentNameSchema,
				componentKey: z.string(),
				headId: z.uuid(),
				value: z.record(z.string(), z.unknown()),
			}),
		)
		.max(50),
	nextCursor: z.string().nullable(),
	revision,
});
