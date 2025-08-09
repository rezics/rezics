import { z } from "zod";
import { User } from "./User";
import { Auditable, icsId, id } from "./common";

export namespace Reaction {
    const Mutable = {
        objectType: z.string(), // e.g. "Comment", "Post", ...
        objectId: id,
        type: z.enum(["like", "dislike", "funny"]),
        userId: id,
    };

    export const Create = z.object({
        ...Mutable,
    });

    export const Read = z
        .object({
            id,
            icsId,
            objectType: z.string(),
            objectId: id,
            type: z.enum(["like", "dislike", "funny"]),
            userId: id,
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
        objectType: z.string(),
        objectId: id,
        type: z.enum(["like", "dislike", "funny"]),
        user: User.Preview,
        ...Auditable.shape,
    });
}

export namespace ReactionStats {
    export const Item = z.object({
        type: Reaction.Create.shape.type,
        count: z.number(),
    });

    export const View = z.array(Item);
}
