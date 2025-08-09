import { z } from "zod";
import { Auditable, icsId, id } from "./common";

export namespace PublishInfo {
    const Mutable = {
        publisherId: id,
        date: z.date(),
        isbn: z.string().nullable(),
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,
            icsId,
            publisherId: id,
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
