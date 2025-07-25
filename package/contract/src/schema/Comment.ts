import { z } from "zod";
import { id, Auditable, Evaluable } from "./common";
import { User } from "./User";

export namespace Comment {
    const Mutable = {
        content: z.string(),
        authorId: id,
        parentId: id.nullable(),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,

            authorId: id,
            parentId: id.nullable(),
        })
        .partial();

    export const Update = z
        .object({
            ...Create.shape,
        })
        .partial();

    export const Delete = z
        .object({
            id,
        })
        .partial();

    export const ViewInner: z.ZodType<any> = z.lazy(() =>
        z.object({
            id,
            content: z.string(),
            author: User.Preview,
            replies: z.array(ViewInner),
            ...Evaluable.shape,
            ...Auditable.shape,
        }),
    );

    export const View = ViewInner;
}
