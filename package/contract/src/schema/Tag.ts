import { z } from "zod";
import { id, Nameable, Auditable, shortString, Tagable } from "./common";
// import { UserSchema } from "./User";

export namespace Tag {
    const Mutable = {
        id,
        ...Nameable.shape,
        ...Tagable.shape,
        ...Auditable.shape,
        color: shortString,
        owner: z.array(id),
        type: z.enum(["book", "thread"]),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z.object({
        id,
    });

    export const View = z.object({
        ...Auditable.shape,
        ...Mutable,
        id,
    });
}

// // Link Schema, Tracking creation information for evaluation purposes
// // ensure cascading deletion
// export const TagBookLinkSchema = z.object({
//     id: id,
//     tag: z.lazy(() => TagSchema),
//     book: z.lazy(() => z.any()), // 使用any来避免循环依赖，在router中会正确使用BookSchema
//     created_at:created_atat,
//     updated_at: updated_at,
//     createdBy: UserSchema,
// });
// export type TagBookLink = z.infer<typeof TagBookLinkSchema>;

// export const TagThreadLinkSchema = z.object({
//     id: id,
//     tag: z.lazy(() => TagSchema),
//     thread: z.lazy(() => ThreadSchema),
//     created_at:created_atat,
//     updated_at: updated_at,
//     createdBy: UserSchema,
// });
// export type TagThreadLink = z.infer<typeof TagThreadLinkSchema>;

// // auditing schema
// export const TagAuditingSchema = z.object({
//     id: id,
//     tag: z.lazy(() => TagSchema),
//     created_at:created_atat,
//     updated_at: updated_at,
//     createdBy: UserSchema,
//     maintainer: id, // Organization ID
// });
// export type TagAuditing = z.infer<typeof TagAuditingSchema>;
