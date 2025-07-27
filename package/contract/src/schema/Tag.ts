import z from "zod";
import { id, Nameable, Auditable, shortString, Relatable } from "./common";
import { Select } from "../util/select";

export namespace Tag {
    const Mutable = {
        ...Nameable.shape,
        ...Relatable.To.shape,
        owner: z.array(id),
        type: shortString,
    };

    export const Create = z.object({
        ...Mutable,
    });

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
        ...Relatable.By.shape,
        ...Auditable.shape,
    });

    export const Read = z.object({
        id,
        select: Select(View),
    });
}
