import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { CatalogPartialDateSchema } from "./catalog";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const count = integer;
const nullableId = z.uuid().nullable().default(null);
const programFields = z.strictObject({
	typeRevisionId: nullableId,
	declaredMainEpisodeCount: integer.nullable().default(null),
	declaredTotalEpisodeCount: integer.nullable().default(null),
});
const seasonFields = z.strictObject({
	programId: nullableId,
	number: z.string().max(4096).nullable().default(null),
});
const versionFields = z.strictObject({
	programId: nullableId,
	versionTypeRevisionId: nullableId,
	lengthMilliseconds: integer.nullable().default(null),
});
const episodeFields = z
	.strictObject({
		programId: nullableId,
		seasonId: nullableId,
		typeRevisionId: nullableId,
		sortNumber: z.number().finite().nullable().default(null),
		episodeNumber: z.number().finite().nullable().default(null),
		discNumber: z.number().int().min(0).max(2_147_483_647).nullable().default(null),
		durationText: z.string().max(4096).nullable().default(null),
		lengthMilliseconds: integer.nullable().default(null),
		date: CatalogPartialDateSchema.default({ year: null, month: null, day: null }),
		dateText: z.string().max(4096).nullable().default(null),
	})
	.refine((value) => value.seasonId === null || value.programId !== null, {
		message: "An episode assigned to a season requires the season's program",
	});

/** Native program structures, independent of source subject classifications. @internal */
export const ProgramStructureSchema = z.discriminatedUnion("shape", [
	z.strictObject({ shape: z.literal("program"), fields: programFields }),
	z.strictObject({ shape: z.literal("season"), fields: seasonFields }),
	z.strictObject({ shape: z.literal("program_version"), fields: versionFields }),
	z.strictObject({ shape: z.literal("episode"), fields: episodeFields }),
]);

/** Complete provider-free fixed fields; unknown source grain can remain a catalog entry. @internal */
export const PublishingStructureSchema = z.discriminatedUnion("shape", [
	z.strictObject({ shape: z.literal("work"), fields: z.strictObject({}) }),
	z.strictObject({
		shape: z.literal("text_version"),
		fields: z.strictObject({
			languageTag: z.string().transform(canonicalizeContentLanguageTag).nullable().default(null),
			methodRevisionId: z.uuid().nullable().default(null),
		}),
	}),
	z.strictObject({
		shape: z.literal("publication"),
		fields: z.strictObject({
			pageCount: count.nullable().default(null),
			paginationText: z.string().max(131_072).nullable().default(null),
		}),
	}),
	z.strictObject({
		shape: z.literal("serialization"),
		fields: z.strictObject({
			textVersionId: z.uuid().nullable().default(null),
			statusRevisionId: z.uuid().nullable().default(null),
		}),
	}),
]);
