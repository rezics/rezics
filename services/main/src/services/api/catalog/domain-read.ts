import type { DatabaseTransaction } from "../../database";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { CatalogAccessDenied, loadCatalogIdentity } from "../../catalog/storage";
import { catalogRead } from "./transaction";
/** @internal Private history requires current native edit authority; denied reads remain non-disclosing. */
export function catalogDomainHistory<T>(
	request: Request,
	reference: CatalogReference,
	work: (tx: DatabaseTransaction, actor: string) => Promise<T>,
) {
	return catalogRead(request, async (tx, actor) => {
		if (actor === null) throw new CatalogAccessDenied();
		await loadCatalogIdentity(tx, reference, actor, true, "share");
		return work(tx, actor);
	});
}
