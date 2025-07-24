import { z } from "zod";
import { UserPreviewSchema } from "./User";
import { id as idSchema, created_at } from "./common";

// ------------------------------------------------------------------
// Award Type & Schema
// ------------------------------------------------------------------
export const AwardSchema = z.object({
    id: idSchema,
    objectType: z.string(), // e.g. "Comment", "Post", ...
    objectId: idSchema,
    // type: z.enum(["award1", "award2", "award3"]),
    type: z.string(), // 为了拓展性
    user: UserPreviewSchema,
    createdAt: created_at,
});
export type Award = z.infer<typeof AwardSchema>;

// ------------------------------------------------------------------
// Award Stats Schema
// ------------------------------------------------------------------
export const AwardStatsItemSchema = z.object({
    type: AwardSchema.shape.type,
    count: z.number(),
});
export const AwardStatsSchema = z.array(AwardStatsItemSchema);
export type AwardStats = z.infer<typeof AwardStatsSchema>;
