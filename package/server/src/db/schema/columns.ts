import { sql } from "drizzle-orm";
import { jsonb, pgSequence, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const uuidv7 = () => uuid().default(sql`uuidv7()`);

export const uuidv7PrimaryKey = () => uuidv7().primaryKey();

export const timestampMs = () => timestamp({ precision: 3 });

export const nullableTimestamp = () => timestampMs();

export const createdAt = () =>
  timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull();

export const updatedAt = () => timestampMs().notNull();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const jsonData = () => jsonb();

export const textArray = () => text().array();

export const pgEnumName = (name: string) => name;

export const post_path_label_seq = pgSequence("post_path_label_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});
