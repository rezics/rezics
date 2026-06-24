import { sql } from "drizzle-orm";
import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const uuidv7 = () => uuid().default(sql`uuidv7()`);

export const uuidv7PrimaryKey = () => uuidv7().primaryKey();

export const timestampMs = () => timestamp({ precision: 3 });

export const nullableTimestamp = () => timestampMs();

export const createdAt = () =>
  timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull();

export const updatedAt = () =>
  timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Persisted JSON columns must be classified by the convention registry. Use
 * `@rezics/contract` envelope helpers for self-describing versioned documents;
 * `task check:convention` rejects unregistered JSON columns and in-database
 * JSON mutation helpers.
 */
export const jsonData = () => jsonb();

export const textArray = () => text().array();

export const pgEnumName = (name: string) => name;
