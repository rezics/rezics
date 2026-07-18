import { sql, type SQLWrapper } from "drizzle-orm";

import { unitLocalization } from "./schema";

/** Select the canonical display title without joining a second localization role. */
export function defaultUnitTitle(unitId: SQLWrapper) {
	return sql<string | null>`(
		select ${unitLocalization.title}
		from ${unitLocalization}
		where ${unitLocalization.unitId} = ${unitId}
			and ${unitLocalization.isDefault} = true
		limit 1
	)`;
}
