import { z } from "zod";
import { CatalogRevisionNumberSchema } from "@rezics/schema/contracts/native/names";
import { GroupingCommandSnapshotSchema } from "./grouping";
import { DomainPageQuerySchema } from "./domain-api-pagination";
import { FractionalPositionInputMaximumBytes, FractionalPositionStorageMaximumBytes, isFractionalPosition } from "@rezics/schema/contracts/native/positions";

const revision = CatalogRevisionNumberSchema;
const key = z.string().min(1).max(160).refine(value => Buffer.byteLength(value, "utf8") <= 160);
export const GroupingOrderPositionSchema = z.string().max(FractionalPositionStorageMaximumBytes).refine(isFractionalPosition);
export const GroupingMutationSchema = z.strictObject({ revision });
export const GroupingEditSchema = z.strictObject({ expectedRevision: revision });
export const GroupingClassSchema = z.strictObject({ classRevisionId: z.uuid() });
export const GroupingOrderProfileSchema = z.strictObject({ id: z.uuid(), key });
export const GroupingOrderProfileEditSchema = GroupingEditSchema.extend({ key });
export const GroupingOrderCreatedSchema = GroupingMutationSchema.extend({ id: z.uuid() });
export const GroupingOrderEntrySchema = z.strictObject({ relationId: z.uuid(), position: GroupingOrderPositionSchema, sourcePosition: z.string().nullable() });
export const GroupingOrderEntryEditSchema = GroupingEditSchema.extend({
	position: z.string().max(FractionalPositionInputMaximumBytes).refine(isFractionalPosition),
	sourcePosition: z.string().max(4096).refine(value => Buffer.byteLength(value, "utf8") <= 4096).optional(),
});
export const GroupingOrderCursorSchema = z.strictObject({ position: GroupingOrderPositionSchema, relationId: z.uuid() });
export const GroupingOrderQuerySchema = DomainPageQuerySchema.extend({ maxSpoiler: z.coerce.number().int().min(0).max(2).pipe(z.union([z.literal(0), z.literal(1), z.literal(2)])).default(0) });
export const GroupingHistorySchema = z.strictObject({ revision, createdAt: z.iso.datetime(), snapshot: GroupingCommandSnapshotSchema });
export const GroupingRestoreSchema = GroupingEditSchema.extend({ historicalRevision: revision });
/** @alpha Named classification and order pages never embed an entire membership graph. */
export const groupingPage = <T extends z.ZodType>(item: T) => z.strictObject({ items: z.array(item).max(100), nextCursor: z.string().nullable() });
