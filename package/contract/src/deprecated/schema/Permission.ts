import { z } from "zod";
import { Auditable, id } from "./common";

export namespace Permission {
    const Access = z.enum(["none", "read-only", "read-write"]);

    const Mutable = {
        root: z.boolean(),
        user: Access,
        book: Access,
        tag: Access,
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,
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
