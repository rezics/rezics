import { z } from "zod";
import { id, Nameable, Auditable } from "./common";

export namespace Author {
    const Mutable = {
        ...Nameable.shape,
        avatar: z.url().nullable(),
        description: z.string().nullable(),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,

            ...Nameable.shape,
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

    export const View = z.object({
        id,
        ...Mutable,
        ...Auditable.shape,
    });
}
