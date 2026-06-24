import type { ExtractTablesFromSchema, RelationsBuilder } from "drizzle-orm";
import type * as schema from "../schema/schema";

export type ServerRelationsBuilder = RelationsBuilder<
  ExtractTablesFromSchema<typeof schema>
>;
