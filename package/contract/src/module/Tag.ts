import { Interface } from "database";
import { Result } from "@selext/core";
import { CRUDContract } from "./util";

export type TagContract = CRUDContract<
    Tag,
    "tag",
    Result<Tag, { name: true; type: true; owners: [{ id: true }] }>,
    never,
    Result<Tag, { id: true }>,
    never,
    Omit<Tag, "id" | keyof Auditable | "related_by">,
    never,
    Result<Tag, { id: true }>,
    never
>;
