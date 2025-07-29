import { CURD, Shallow } from "./common";

import { Auditable, Tag as DTag, Relatable } from "database/interface";

export type Tag = CURD<
    "/tag",
    DTag,
    Omit<Shallow<DTag>, "id" | keyof Auditable | keyof Relatable>,
    Partial<Omit<DTag, "id" | keyof Auditable | "related_by">>,
    Extract<DTag, { id: string }>,
    Extract<DTag, { id: string }>
>;
