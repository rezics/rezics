import { UnitContentLicenseSlugs, type UnitContentLicenseSlug } from "@rezics/license";
import { inArray, sql } from "drizzle-orm";
import { check, index, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

/**
 * One immutable grant of the referenced REZICS content license for a Unit.
 *
 * The active grant is the row whose `revokedAt` is null. A later grant creates
 * a new row so prior revocation history remains intact.
 */
export const unitContentLicense = pgTable(
	"unit_content_license",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		grantedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		referenceLicenseSlug: text().$type<UnitContentLicenseSlug>().notNull(),
		grantedAt: createTimestampMsColumn().defaultNow().notNull(),
		revokedAt: createTimestampMsColumn(),
	},
	(table) => [
		uniqueIndex("unit_content_license_active_unit_key")
			.on(table.unitId)
			.where(sql`${table.revokedAt} is null`),
		index("unit_content_license_granted_by_idx").on(table.grantedByProfileId),
		index("unit_content_license_reference_slug_idx").on(table.referenceLicenseSlug),
		check(
			"unit_content_license_reference_slug_check",
			inArray(table.referenceLicenseSlug, UnitContentLicenseSlugs),
		),
		check(
			"unit_content_license_revocation_check",
			sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.grantedAt}`,
		),
	],
);
