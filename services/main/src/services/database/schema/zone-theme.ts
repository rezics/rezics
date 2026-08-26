import { inArray, sql } from "drizzle-orm";
import { check, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { type ZoneThemeRevisionState, ZoneThemeRevisionStateValues } from "./contract-values";
import { imageAsset } from "./image";
import { profile } from "./profile";
import { unit } from "./unit";

export interface StoredZoneThemeAutomatedReview extends Record<string, unknown> {
	readonly contractVersion: string;
	readonly declarationCount: number;
	readonly minifiedBytes: number;
	readonly ruleCount: number;
	readonly selectorCount: number;
}

export interface StoredZoneThemeRenderReview extends Record<string, unknown> {
	readonly captures: readonly {
		readonly breakpoint: 375 | 768 | 1280;
		readonly colorScheme: "light" | "dark";
		readonly screenshotAssetId: string;
		readonly layoutShift: number;
		readonly contrastViolations: number;
	}[];
}

export interface StoredZoneThemeAiReview extends Record<string, unknown> {
	readonly model: string;
	readonly passed: boolean;
	readonly findings: readonly string[];
}

/** Unit subtype carrying reusable custom Zone-theme identity and localization. */
export const zoneTheme = pgTable("zone_theme", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/**
 * Immutable source submission plus mutable, reproducible review control state.
 * A new CSS submission always creates a new row. Contract revalidation may refresh
 * only derived output and evidence; it never rewrites source CSS or asset bindings.
 */
export const zoneThemeRevision = pgTable(
	"zone_theme_revision",
	{
		id: createUuidv7PrimaryKey(),
		themeUnitId: uuid()
			.notNull()
			.references(() => zoneTheme.id, { onDelete: "cascade" }),
		contractVersion: text().notNull(),
		sourceCss: text().notNull(),
		transformedCss: text().notNull(),
		sha256: text().notNull(),
		state: text().$type<ZoneThemeRevisionState>().default("pending_automated").notNull(),
		automatedReview: createJsonObjectColumn<StoredZoneThemeAutomatedReview>().notNull(),
		renderReview: createJsonObjectColumn<StoredZoneThemeRenderReview>(),
		aiReview: createJsonObjectColumn<StoredZoneThemeAiReview>(),
		submittedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		humanReviewedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		humanReviewedAt: createTimestampMsColumn(),
		decisionReason: text(),
		killedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		killedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("zone_theme_revision_theme_id_idx").on(table.themeUnitId, table.id),
		index("zone_theme_revision_review_queue_idx")
			.on(table.id)
			.where(
				sql`${table.state} in ('pending_automated', 'pending_human', 'revalidation_required')`,
			),
		index("zone_theme_revision_approved_contract_id_idx")
			.on(table.contractVersion, table.id)
			.where(sql`${table.state} = 'approved'`),
		check("zone_theme_revision_state_check", inArray(table.state, ZoneThemeRevisionStateValues)),
		check("zone_theme_revision_source_size_check", sql`octet_length(${table.sourceCss}) <= 65536`),
		check(
			"zone_theme_revision_transformed_size_check",
			sql`octet_length(${table.transformedCss}) <= 65536`,
		),
		check("zone_theme_revision_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
		check(
			"zone_theme_revision_human_review_shape_check",
			sql`(${table.humanReviewedAt} is null) = (${table.humanReviewedByProfileId} is null)`,
		),
		check(
			"zone_theme_revision_kill_shape_check",
			sql`(${table.killedAt} is null) = (${table.killedByProfileId} is null)`,
		),
		createJsonObjectConstraint(
			"zone_theme_revision_render_review_json_object_check",
			table.renderReview,
		),
		createJsonObjectConstraint("zone_theme_revision_ai_review_json_object_check", table.aiReview),
	],
);

/** Only assets explicitly bound here may appear in this revision's url() values. */
export const zoneThemeRevisionAsset = pgTable(
	"zone_theme_revision_asset",
	{
		revisionId: uuid()
			.notNull()
			.references(() => zoneThemeRevision.id, { onDelete: "cascade" }),
		assetId: uuid()
			.notNull()
			.references(() => imageAsset.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.assetId] }),
		index("zone_theme_revision_asset_asset_idx").on(table.assetId, table.revisionId),
	],
);
