import { defineRelationsPart, sql } from "drizzle-orm";
import { text, timestamp, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./base";

export const users = pgTable("users", {
	id: uuid("id")
		.default(sql`uuidv7()`)
		.primaryKey(),
	/** @UNIT_LOCALIZATION_EXEMPT Identity-provider source name, not the public Profile title. */
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id")
			.default(sql`uuidv7()`)
			.primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.notNull(),
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
		id: uuid("id")
			.default(sql`uuidv7()`)
			.primaryKey(),
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
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("accounts_provider_id_account_id_key").on(table.providerId, table.accountId),
		index("accounts_user_id_idx").on(table.userId),
	],
);

export const verifications = pgTable(
	"verifications",
	{
		id: uuid("id")
			.default(sql`uuidv7()`)
			.primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const authRelations = defineRelationsPart(
	{ users, sessions, accounts, verifications },
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
