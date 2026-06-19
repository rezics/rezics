import { t } from "elysia";

type LiteralValue = string | number | boolean;

/**
 * Closed vocabularies keep their literal source in a `*Values` tuple. The
 * schema is derived from that source for multi-value vocabularies; single-value
 * vocabularies can stay as direct literals at their public contract surface.
 */
export function literalSchemaFromValues<
  const T extends readonly LiteralValue[],
>(values: T) {
  if (values.length === 0) {
    throw new Error("literalSchemaFromValues requires at least one value");
  }

  const literals = values.map((value) => t.Literal(value));
  return literals.length === 1 ? literals[0] : t.Union(literals);
}
