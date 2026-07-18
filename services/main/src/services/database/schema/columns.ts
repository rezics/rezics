import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";

export const createUuidv7PrimaryKey = () =>
	uuid()
		.default(sql`uuidv7()`)
		.primaryKey();

/** Every persisted instant is UTC-aware and millisecond precise. */
export const createTimestampMsColumn = () => timestamp({ withTimezone: true, precision: 3 });

export const createCreatedAtColumn = () => createTimestampMsColumn().defaultNow().notNull();

export const createUpdatedAtColumn = () =>
	createTimestampMsColumn()
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull();

/**
 * Persistence deliberately does not know the domain document shape.
 * Callers must validate unknown values with the owning product schema.
 */
export const createJsonDocumentColumn = () => jsonb().$type<unknown>();

export const createJsonObjectColumn = <
	T extends Record<string, unknown> = Record<string, unknown>,
>() => jsonb().$type<T>();

export const createJsonObjectConstraint = (name: string, column: AnyPgColumn) =>
	check(name, sql`${column} is null or jsonb_typeof(${column}) = 'object'`);
