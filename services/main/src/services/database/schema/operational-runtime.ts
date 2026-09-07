import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	timestamp,
	uuid,
	unique,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { operationalOutbox } from "./operational-durability";

/** Unsent transport copies only; PostgreSQL does not schedule executable tasks here. @internal */
export const operationalRelayPending = pgTable(
	"operational_relay_pending",
	{
		routingBucket: integer().notNull(),
		messageId: uuid().notNull(),
		messageClass: text().notNull(),
		routingEpoch: bigint({ mode: "number" }).notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.messageId] }),
		foreignKey({
			name: "operational_relay_pending_outbox_fk",
			columns: [t.routingBucket, t.messageId],
			foreignColumns: [operationalOutbox.routingBucket, operationalOutbox.messageId],
		}).onDelete("restrict"),
		index("operational_relay_pending_pick_idx").on(
			t.routingBucket,
			t.messageClass,
			t.routingEpoch,
			t.createdAt,
			t.messageId,
		),
	],
);

/** Operator-bounded checkpoints: 1024 buckets, two families, at most 64 consumers per stream. @internal */
export const operationalConsumerCheckpoint = pgTable(
	"operational_consumer_checkpoint",
	{
		routingBucket: integer().notNull(),
		messageClass: text().notNull(),
		consumerKey: text().notNull(),
		consumerSlot: integer().notNull(),
		routingEpoch: bigint({ mode: "number" }).notNull(),
		streamCreatedAt: text().notNull(),
		nextSequence: bigint({ mode: "number" }).notNull(),
		state: text().$type<"active" | "replay_required">().default("active").notNull(),
		updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.messageClass, t.consumerKey] }),
		unique("operational_checkpoint_slot_key").on(t.routingBucket, t.messageClass, t.consumerSlot),
		check(
			"operational_checkpoint_bounds_check",
			sql`${t.consumerSlot} between 0 and 63 and ${t.routingBucket} between 0 and 1023 and ${t.messageClass} in ('event','task') and ${t.routingEpoch} between 1 and 9007199254740991 and ${t.nextSequence} between 1 and 9007199254740991 and ${t.state} in ('active','replay_required') and octet_length(${t.consumerKey}) between 1 and 64 and octet_length(${t.streamCreatedAt}) between 1 and 64`,
		),
	],
);
