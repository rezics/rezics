import { inArray, sql } from "drizzle-orm";
import { bigint, check, smallint, text } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createTimestampMsColumn } from "./columns";
import { type VndbV11CutoverState, VndbV11CutoverStateValues } from "./contract-values";

/** Singleton writer fence retained across the incompatible vndb-v11 binary cutover. */
export const vndbV11CutoverControl = pgTable(
	"vndb_v11_cutover_control",
	{
		id: smallint().default(1).primaryKey(),
		state: text().$type<VndbV11CutoverState>().default("precontract_open").notNull(),
		transitionEpoch: bigint({ mode: "bigint" }).default(0n).notNull(),
		stateChangedAt: createTimestampMsColumn().defaultNow().notNull(),
		operator: text(),
		reason: text(),
	},
	(table) => [
		check("vndb_v11_cutover_control_singleton_check", sql`${table.id} = 1`),
		check("vndb_v11_cutover_control_state_check", inArray(table.state, VndbV11CutoverStateValues)),
		check("vndb_v11_cutover_control_epoch_check", sql`${table.transitionEpoch} >= 0`),
		check(
			"vndb_v11_cutover_control_audit_check",
			sql`(
				${table.state} = 'precontract_open'
				and (
					(
						${table.transitionEpoch} = 0
						and ${table.operator} is null
						and ${table.reason} is null
					) or (
						${table.transitionEpoch} > 0
						and ${table.operator} is not null
						and btrim(${table.operator}) <> ''
						and ${table.reason} is not null
						and btrim(${table.reason}) <> ''
					)
				)
			) or (
				${table.state} in ('paused', 'postcontract_open')
				and ${table.operator} is not null
				and btrim(${table.operator}) <> ''
				and ${table.reason} is not null
				and btrim(${table.reason}) <> ''
			)`,
		),
	],
);

/** Append-only audit anchor for every singleton cutover transition. */
export const vndbV11CutoverTransition = pgTable(
	"vndb_v11_cutover_transition",
	{
		transitionEpoch: bigint({ mode: "bigint" }).primaryKey(),
		previousState: text().$type<VndbV11CutoverState>(),
		state: text().$type<VndbV11CutoverState>().notNull(),
		transitionedAt: createTimestampMsColumn().notNull(),
		operator: text(),
		reason: text(),
	},
	(table) => [
		check("vndb_v11_cutover_transition_epoch_check", sql`${table.transitionEpoch} >= 0`),
		check(
			"vndb_v11_cutover_transition_state_check",
			sql`${inArray(table.state, VndbV11CutoverStateValues)} and (
				${table.previousState} is null
				or ${inArray(table.previousState, VndbV11CutoverStateValues)}
			)`,
		),
		check(
			"vndb_v11_cutover_transition_audit_check",
			sql`(
				${table.transitionEpoch} = 0
				and ${table.previousState} is null
				and ${table.state} = 'precontract_open'
				and ${table.operator} is null
				and ${table.reason} is null
			) or (
				${table.transitionEpoch} > 0
				and ${table.previousState} is not null
				and ${table.operator} is not null
				and btrim(${table.operator}) <> ''
				and ${table.reason} is not null
				and btrim(${table.reason}) <> ''
			)`,
		),
	],
);
