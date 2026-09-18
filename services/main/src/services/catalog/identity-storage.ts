import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { CatalogIdentityInputSchema, type CatalogIdentityInput } from "@rezics/schema/contracts/native/catalog";

/**
 * Write a native identity and its initial provenance in the caller's transaction.
 * @remarks Authorization is enforced by catalog admission or the dedicated
 * account/persona constructor before this storage primitive is called. It does
 * not create a participation binding or grant and is not a public command.
 * @internal
 */
export async function insertCatalogIdentity(
	tx: DatabaseTransaction,
	input: CatalogIdentityInput,
	actor: string,
) {
	const { owner, ...values } = CatalogIdentityInputSchema.parse(input);
	z.uuid().parse(actor);
	const [created] = await tx
		.insert(CatalogIdentityTables[owner])
		.values({ ...values, createdByAuthUserId: actor })
		.returning({
			id: CatalogIdentityTables[owner].id,
			revision: CatalogIdentityTables[owner].revision,
		});
	if (!created) throw new Error("Catalog identity insertion returned no row");
	await tx.insert(CatalogFactTables[owner].change).values({
		ownerId: created.id,
		version: 1,
		actorAuthUserId: actor,
		operation: "identity.create",
	});
	return { owner, id: created.id, revision: created.revision };
}
