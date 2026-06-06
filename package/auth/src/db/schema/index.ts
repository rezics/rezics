import * as schema from "./auth";

export { schema };
export const relations = {};
export type AuthSchema = typeof schema;
export type AuthRelations = typeof relations;
export * from "./auth";
