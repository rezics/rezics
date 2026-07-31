import { UnitContentLicenseSlugs, type UnitContentLicenseSlug } from "@rezics/license";
import { inArray } from "drizzle-orm";
import { check, index, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

/**
 * One immutable grant of the referenced REZICS content license for a Unit.
 *
 * A Unit can receive this grant once. Availability and removal are independent
 * Unit lifecycle concerns and never mutate the grant.
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
	},
	(table) => [
		uniqueIndex("unit_content_license_unit_key").on(table.unitId),
		index("unit_content_license_granted_by_idx").on(table.grantedByProfileId),
		index("unit_content_license_reference_slug_idx").on(table.referenceLicenseSlug),
		check(
			"unit_content_license_reference_slug_check",
			inArray(table.referenceLicenseSlug, UnitContentLicenseSlugs),
		),
	],
);
