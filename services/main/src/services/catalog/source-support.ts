import type { DatabaseTransaction } from "../database";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";

/** Curated evidence is not an adoption correspondence. Automatic writers must use the non-null pair. */
export type CatalogSourceSupportScope =
	| { sourceMappingKey: null; sourceCorrespondenceRevision: null }
	| { sourceMappingKey: string; sourceCorrespondenceRevision: number };

/** @internal Persist the containing source mapping's exact epoch, independently of the supported native owner. */
export async function catalogSourceSupportColumns(tx: DatabaseTransaction, sourceRecordId: string) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
	return {
		sourceMappingKey: scope.mappingKey,
		sourceCorrespondenceRevision: scope.correspondenceRevision,
	};
}
