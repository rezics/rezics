import { id, Nameable, Evaluable, Tagable } from "./common";
import { z } from "zod";

export namespace Chapter {
    export const Create = z.object({
        ...Nameable.shape,
        ...Evaluable.shape,
        ...Tagable.shape,
        book: id,
    });

    export const Read = z.object({
        book: id,
        chapter: id,
    });

    export const View = z.object({
        ...Nameable.shape,
        ...Evaluable.shape,
        ...Tagable.shape,
        id,
    });
}

export const ChapterOrder = z.map(id, z.array(id));

export type ChapterOrder = z.infer<typeof ChapterOrder>;
