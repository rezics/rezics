import {
	createPlatformIdentityColumns,
	platformIdentityConstraints,
} from "../shared/platform-identity";

import { pgTable } from "../shared/base";

/**
 * A lightweight localized-title Unit for headings and display labels.
 *
 * Label content lives in Unit localizations; this marker deliberately has no
 * domain fields of its own.
 */
export const label = pgTable(
	"label",
	{
		...createPlatformIdentityColumns(),
	},
	(table) => platformIdentityConstraints("label", table),
);
