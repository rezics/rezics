import { describe, expect, test } from "bun:test";

import * as authSchema from "../../../../auth/src/db/schema";
import * as historySchema from "../../../../history/src/db/schema";
import * as notifySchema from "../../../../notify/src/db/schema";
import * as rankingSchema from "../../../../ranking/src/db/schema";
import * as reactionSchema from "../../../../backend/src/reaction/db/schema";
import * as serverSchema from "./schema";

type SchemaOwner = {
  expectedUpdatedAtColumns: number;
  schema: Record<string, unknown>;
};

const owners = {
  server: { schema: serverSchema, expectedUpdatedAtColumns: 63 },
  auth: { schema: authSchema, expectedUpdatedAtColumns: 7 },
  notify: { schema: notifySchema, expectedUpdatedAtColumns: 1 },
  history: { schema: historySchema, expectedUpdatedAtColumns: 2 },
  ranking: { schema: rankingSchema, expectedUpdatedAtColumns: 4 },
  reaction: { schema: reactionSchema, expectedUpdatedAtColumns: 0 },
} satisfies Record<string, SchemaOwner>;

const isDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
const tableName = Symbol.for("drizzle:Name");

function updatedAtColumns(schema: Record<string, unknown>) {
  return Object.values(schema)
    .filter(
      (value): value is { [key: symbol]: unknown; updatedAt?: unknown } => {
        if (!value || typeof value !== "object") return false;
        return Boolean((value as Record<symbol, unknown>)[isDrizzleTable]);
      },
    )
    .flatMap((table) => {
      const updatedAt = table.updatedAt as
        | { hasDefault?: boolean; name?: string }
        | undefined;
      return updatedAt?.name === "updatedAt"
        ? [{ table: String(table[tableName]), column: updatedAt }]
        : [];
    })
    .sort((a, b) => a.table.localeCompare(b.table));
}

describe("schema updatedAt defaults", () => {
  for (const [owner, config] of Object.entries(owners)) {
    test(`${owner} updatedAt columns have insert defaults`, () => {
      const columns = updatedAtColumns(config.schema);

      expect(columns).toHaveLength(config.expectedUpdatedAtColumns);
      expect(
        columns
          .filter(({ column }) => !column.hasDefault)
          .map(({ table }) => table),
      ).toEqual([]);
    });
  }
});
