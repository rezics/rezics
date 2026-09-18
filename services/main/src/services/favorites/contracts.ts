import { z } from "zod";
import { isStorageSafeFractionalPosition } from "@rezics/schema/contracts/native/positions";
import { UnitReferenceSchema } from "@rezics/reference";

const bytes = (maximum: number) =>
	z.string().refine((value) => Buffer.byteLength(value, "utf8") <= maximum);
/** @alpha Account-private Favorites previews and notes; never public catalog metadata. */
export const FavoritePreviewSchema = z.strictObject({
	title: bytes(2048).nullable(),
	summary: bytes(4096).nullable(),
	language: z.string().max(255).nullable(),
	capturedAt: z.iso.datetime(),
});
export const FavoriteSnapshotSchema = z.strictObject({
	target: UnitReferenceSchema,
	position: z.string().refine(isStorageSafeFractionalPosition),
	note: bytes(65536).nullable(),
	preview: FavoritePreviewSchema,
});
export const SaveFavoriteSchema = z.strictObject({
	expectedRevision: z
		.number()
		.int()
		.nonnegative()
		.max(Number.MAX_SAFE_INTEGER - 1),
	note: bytes(65536).nullable().optional(),
	/** Null moves to the beginning; absent preserves existing order or appends a new entry. */
	afterTargetId: z.uuid().nullable().optional(),
	refreshPreview: z.boolean().default(false),
});
export const FavoriteEntrySchema = FavoriteSnapshotSchema.extend({
	revision: z.number().int().positive().safe(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export const FavoriteListQuerySchema = z.strictObject({
	afterPosition: z.string().refine(isStorageSafeFractionalPosition).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const FavoriteListSchema = z.strictObject({
	revision: z.number().int().nonnegative().safe(),
	items: z.array(FavoriteEntrySchema),
	nextCursor: z.string().nullable(),
});
export const FavoriteMutationSchema = z.strictObject({
	revision: z.number().int().positive().safe(),
	entry: FavoriteEntrySchema.nullable(),
});
export const FavoriteStateSchema = z.strictObject({
	revision: z.number().int().nonnegative().safe(),
	entry: FavoriteEntrySchema.nullable(),
});
export const FavoriteHistoryItemSchema = z.strictObject({
	revision: z.number().int().positive().safe(),
	operation: z.enum(["save", "update", "delete", "restore"]),
	createdAt: z.iso.datetime(),
});
export const FavoriteHistorySchema = z.strictObject({
	items: z.array(FavoriteHistoryItemSchema),
	nextCursor: z.number().int().positive().safe().nullable(),
});
export const FavoriteRevisionSchema = FavoriteHistoryItemSchema.extend({
	snapshot: FavoriteSnapshotSchema.nullable(),
});
