import { UnitContentLicenseSlugs, type UnitContentLicenseSlug } from "@rezics/license";
import { inArray, sql } from "drizzle-orm";
import { check, index, pgEnum, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { toEnumValues, UnitContentLicenseStatusValues } from "./contract-values";
import { profile } from "./profile";
import { unit } from "./unit";

export const unitContentLicenseStatus = pgEnum(
	"unit_content_license_status",
	toEnumValues(UnitContentLicenseStatusValues),
);

/**
 * One recorded grant of the referenced REZICS content license for a Unit.
 *
 * Grant identity, actor, terms, and time are immutable. Platform governance can
 * reversibly invalidate its recognition of a grant without erasing that
 * historical assertion. At most one grant is active for a Unit.
 */
export const unitContentLicense = pgTable(
	"unit_content_license",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		grantedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		referenceLicenseSlug: text().$type<UnitContentLicenseSlug>().notNull(),
		grantedAt: createTimestampMsColumn().defaultNow().notNull(),
		status: unitContentLicenseStatus().default("active").notNull(),
	},
	(table) => [
		uniqueIndex("unit_content_license_active_unit_key")
			.on(table.unitId)
			.where(sql`${table.status} = 'active'`),
		index("unit_content_license_unit_granted_at_idx").on(table.unitId, table.grantedAt.desc()),
		index("unit_content_license_granted_by_idx").on(table.grantedByProfileId),
		index("unit_content_license_reference_slug_idx").on(table.referenceLicenseSlug),
		check(
			"unit_content_license_reference_slug_check",
			inArray(table.referenceLicenseSlug, UnitContentLicenseSlugs),
		),
	],
);
