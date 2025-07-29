import { z } from "zod";
import { id, icsId, Nameable, Auditable, Evaluable, Tagable } from "./common";
import { PublishInfo } from "./PublishInfo";

export namespace Book {
    const Mutable = {
        ...Nameable.shape,
        ...Tagable.shape,
        cover: z.url().nullable(),
        author: z.array(id),
        rating: z.number().nullable(),
        length: z.int().nullable(),
        publishInfo: z.array(PublishInfo.View),
        tags: z.array(id),
        description: z.string().nullable(),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            ...Nameable.shape,
            ...Tagable.shape,
            id,
            icsId,
            publisher: z.array(id),
            author: z.array(id),
            rating: z.number(),
            length: z.int(),
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
        ...Mutable,
        ...Evaluable.shape,
        ...Auditable.shape,
        id,
        icsId,
    });
}
