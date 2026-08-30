import { defineRelationsPart, inArray, sql } from "drizzle-orm";
import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import {
	text,
	timestamp,
	boolean,
	check,
	integer,
	uuid,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";

export const users = pgTable(
	"users",
	{
		id: uuid("id").default(sql`uuidv7()`).primaryKey(),
		/** @UNIT_LOCALIZATION_EXEMPT Identity source: provider-owned sign-in name; public Profile titles remain Unit localizations. */
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		registrationContentLanguage: text("registration_content_language")
			.$type<ContentLanguage>()
			.default("en")
			.notNull(),
	},
	(table) => [
		check(
			"users_registration_content_language_check",
			inArray(table.registrationContentLanguage, ContentLanguageValues),
		),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").default(sql`uuidv7()`).primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").default(sql`uuidv7()`).primaryKey(),
		issuer: text("issuer").default("local:credential").notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
			precision: 3,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
			precision: 3,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("accounts_provider_id_account_id_key").on(table.providerId, table.accountId),
		uniqueIndex("accounts_issuer_account_id_key").on(table.issuer, table.accountId),
		index("accounts_user_id_idx").on(table.userId),
	],
);

export const verifications = pgTable(
	"verifications",
	{
		id: uuid("id").default(sql`uuidv7()`).primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const apikeys = pgTable(
	"apikeys",
	{
		id: uuid("id").default(sql`uuidv7()`).primaryKey(),
		configId: text("config_id").default("default").notNull(),
		name: text("name"),
		start: text("start"),
		referenceId: uuid("reference_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		prefix: text("prefix"),
		key: text("key").notNull(),
		refillInterval: integer("refill_interval"),
		refillAmount: integer("refill_amount"),
		lastRefillAt: timestamp("last_refill_at", { withTimezone: true, precision: 3 }),
		enabled: boolean("enabled").default(true),
		rateLimitEnabled: boolean("rate_limit_enabled").default(true),
		rateLimitTimeWindow: integer("rate_limit_time_window").default(60000),
		rateLimitMax: integer("rate_limit_max").default(5000),
		requestCount: integer("request_count").default(0),
		remaining: integer("remaining"),
		lastRequest: timestamp("last_request", { withTimezone: true, precision: 3 }),
		expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull(),
		permissions: text("permissions"),
		metadata: text("metadata"),
	},
	(table) => [
		index("apikeys_config_id_idx").on(table.configId),
		index("apikeys_reference_id_idx").on(table.referenceId),
		uniqueIndex("apikeys_key_key").on(table.key),
	],
);

export const authRelations = defineRelationsPart(
	{ users, sessions, accounts, verifications, apikeys },
	(r) => ({
		users: {
			sessions: r.many.sessions({
				from: r.users.id,
				to: r.sessions.userId,
			}),
			accounts: r.many.accounts({
				from: r.users.id,
				to: r.accounts.userId,
			}),
		},
		sessions: {
			user: r.one.users({
				from: r.sessions.userId,
				to: r.users.id,
			}),
		},
		accounts: {
			user: r.one.users({
				from: r.accounts.userId,
				to: r.users.id,
			}),
		},
	}),
);
