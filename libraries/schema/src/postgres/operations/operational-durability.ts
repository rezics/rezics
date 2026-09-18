import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	integer,
	jsonb,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";

/** @internal Finite, provisioned storage credits; an absent lane rejects admission. */
export const operationalCapacity = pgTable(
	"operational_capacity",
	{
		routingBucket: integer().notNull(),
		lane: text().notNull(),
		maximumRows: bigint({ mode: "bigint" }).notNull(),
		maximumBytes: bigint({ mode: "bigint" }).notNull(),
		reservedRows: bigint({ mode: "bigint" }).default(0n).notNull(),
		reservedBytes: bigint({ mode: "bigint" }).default(0n).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.lane] }),
		check("operational_capacity_bucket_check", sql`${t.routingBucket} between 0 and 1023`),
		check(
			"operational_capacity_lane_check",
			sql`${t.lane} in ('event-outbox', 'task-outbox', 'task-intent', 'receipt')`,
		),
		check(
			"operational_capacity_bounds_check",
			sql`${t.maximumRows} between 1 and 1000000000 and ${t.maximumBytes} between 1 and 1000000000000000 and ${t.reservedRows} between 0 and ${t.maximumRows} and ${t.reservedBytes} between 0 and ${t.maximumBytes}`,
		),
	],
);

/** @internal Immutable committed transport envelopes, partitioned by the exporter. */
export const operationalOutbox = pgTable(
	"operational_outbox",
	{
		routingBucket: integer().notNull(),
		messageId: uuid().notNull(),
		messageClass: text().notNull(),
		kind: text().notNull(),
		routingEpoch: bigint({ mode: "number" }).notNull(),
		subject: text().notNull(),
		aggregateKey: text().notNull(),
		occurredAt: timestamp({ withTimezone: true }).notNull(),
		payload: jsonb().notNull(),
		serializedEnvelope: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.messageId] }),
		check("operational_outbox_bucket_check", sql`${t.routingBucket} between 0 and 1023`),
		check(
			"operational_outbox_route_check",
			sql`(${t.routingBucket} = mod(get_byte(sha256(convert_to((${t.payload}->'aggregate'->>'owner') || ':' || ${t.aggregateKey}, 'UTF8')), 0) * 256 + get_byte(sha256(convert_to((${t.payload}->'aggregate'->>'owner') || ':' || ${t.aggregateKey}, 'UTF8')), 1), 1024)) is true`,
		),
		check(
			"operational_outbox_fields_check",
			sql`${t.messageClass} in ('event','task') and octet_length(${t.kind}) between 1 and 128 and ${t.kind} ~ '^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)*$' and ${t.routingEpoch} between 1 and 9007199254740991 and octet_length(${t.subject}) between 1 and 256 and octet_length(${t.aggregateKey}) between 1 and 1024 and ${t.subject} = 'rezics.' || case when ${t.messageClass} = 'event' then 'events' else 'tasks' end || '.e' || ${t.routingEpoch}::text || '.b' || ${t.routingBucket}::text || '.' || ${t.kind}`,
		),
		check(
			"operational_outbox_payload_check",
			sql`(jsonb_typeof(${t.payload}) = 'object' and octet_length(${t.serializedEnvelope}) <= 65536 and ${t.serializedEnvelope}::jsonb = ${t.payload} and (${t.payload}->>'version') = '1' and (${t.payload}->>'messageId') = ${t.messageId}::text and (${t.payload}->>'class') = ${t.messageClass} and (${t.payload}->>'kind') = ${t.kind} and (${t.payload}->>'routingBucket') = ${t.routingBucket}::text and (${t.payload}->>'routingEpoch') = ${t.routingEpoch}::text and (${t.payload}->'aggregate'->>'key') = ${t.aggregateKey} and (${t.payload}->>'occurredAt')::timestamptz = ${t.occurredAt}) is true`,
		),
	],
);

/** @internal Exact-operation execution authority; deliberately has no ready-work index. */
export const operationalTaskIntent = pgTable(
	"operational_task_intent",
	{
		routingBucket: integer().notNull(),
		operationId: uuid().notNull(),
		consumerKey: text().notNull(),
		requestFingerprint: text().notNull(),
		originMessageId: uuid().notNull(),
		state: text()
			.$type<"pending" | "running" | "succeeded" | "cancelled" | "failed" | "superseded">()
			.default("pending")
			.notNull(),
		fencingGeneration: bigint({ mode: "bigint" }).default(0n).notNull(),
		attemptCount: integer().default(0).notNull(),
		maximumAttempts: integer().notNull(),
		deadline: timestamp({ withTimezone: true }).notNull(),
		availableAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		leaseExpiresAt: timestamp({ withTimezone: true }),
		lastError: text(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.operationId] }),
		foreignKey({
			name: "operational_task_origin_fk",
			columns: [t.routingBucket, t.originMessageId],
			foreignColumns: [operationalOutbox.routingBucket, operationalOutbox.messageId],
		}).onDelete("restrict"),
		check("operational_task_bucket_check", sql`${t.routingBucket} between 0 and 1023`),
		check(
			"operational_task_request_check",
			sql`${t.requestFingerprint} ~ '^[a-f0-9]{64}$' and octet_length(${t.consumerKey}) between 1 and 128 and ${t.maximumAttempts} between 1 and 32 and ${t.attemptCount} between 0 and ${t.maximumAttempts} and ${t.fencingGeneration} >= 0 and ${t.deadline} > ${t.createdAt} and ${t.deadline} <= ${t.createdAt} + interval '7 days' and (${t.lastError} is null or octet_length(${t.lastError}) <= 512)`,
		),
		check(
			"operational_task_state_check",
			sql`${t.state} in ('pending','running','succeeded','cancelled','failed','superseded') and ((${t.state} = 'running' and ${t.leaseExpiresAt} is not null and ${t.fencingGeneration} > 0 and ${t.attemptCount} > 0) or (${t.state} <> 'running' and ${t.leaseExpiresAt} is null))`,
		),
	],
);

/** @internal Retained effective-application proof; consumer identity includes output generation. */
export const operationalApplicationReceipt = pgTable(
	"operational_application_receipt",
	{
		consumerKey: text().notNull(),
		routingBucket: integer().notNull(),
		operationId: uuid().notNull(),
		taskOperationId: uuid(),
		requestFingerprint: text().notNull(),
		outcome: text().$type<"succeeded" | "cancelled" | "failed" | "superseded">().notNull(),
		detail: text().notNull(),
		completedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.routingBucket, t.consumerKey, t.operationId] }),
		foreignKey({
			name: "operational_receipt_task_fk",
			columns: [t.routingBucket, t.taskOperationId],
			foreignColumns: [operationalTaskIntent.routingBucket, operationalTaskIntent.operationId],
		}).onDelete("restrict"),
		check("operational_receipt_bucket_check", sql`${t.routingBucket} between 0 and 1023`),
		check(
			"operational_receipt_fields_check",
			sql`${t.requestFingerprint} ~ '^[a-f0-9]{64}$' and octet_length(${t.consumerKey}) between 1 and 128 and octet_length(${t.detail}) <= 512 and ${t.outcome} in ('succeeded','cancelled','failed','superseded') and (${t.taskOperationId} is null or ${t.taskOperationId} = ${t.operationId})`,
		),
	],
);
