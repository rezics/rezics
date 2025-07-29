import { z } from "zod";
import { User } from "./User";
import { id, icsId, Auditable, Evaluable, Nameable } from "./common";

export namespace Review {
    const Mutable = {
        ...Nameable.shape,
        content: z.string(),
        rating: z.number(),
        userId: id,
        bookId: id,
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,
            icsId,
            userId: id,
            bookId: id,
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
            icsId,
        })
        .partial();

    export const View = z.object({
        id,
        icsId,
        ...Mutable,
        user: User.Preview,
        ...Evaluable.shape,
        ...Auditable.shape,
    });
}

export namespace Quote {
    const Mutable = {
        content: z.string(),
        userId: id,
        bookId: id,
        chapterId: id,
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,
            icsId,
            userId: id,
            bookId: id,
            chapterId: id,
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
            icsId,
        })
        .partial();

    export const View = z.object({
        id,
        icsId,
        ...Mutable,
        user: User.Preview,
        ...Evaluable.shape,
        ...Auditable.shape,
    });
}
