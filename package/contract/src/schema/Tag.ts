import { z } from "zod";
import { id, icsId, Nameable, Auditable, shortString, Tagable } from "./common";

export namespace Tag {
    const Mutable = {
        ...Nameable.shape,
        ...Tagable.shape,
        color: shortString,
        owner: z.array(id),
        type: z.enum(["book", "thread"]),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id
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
        ...Auditable.shape,
    });
}
