import { eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../../database";
import { slugNamespace } from "../../database/schema";
import { SlugNamespaceManifest } from "../data";
import { assertFields } from "./common";

/** Permanent routing namespaces are bounded control rows, not logical Unit identities. */
export async function ensureSlugNamespaces(tx: DatabaseTransaction): Promise<void> {
	for (const namespace of SlugNamespaceManifest) {
		await tx
			.insert(slugNamespace)
			.values({ id: namespace.id, name: namespace.slug })
			.onConflictDoNothing();
		const [stored] = await tx
			.select({ id: slugNamespace.id, name: slugNamespace.name })
			.from(slugNamespace)
			.where(eq(slugNamespace.id, namespace.id))
			.limit(1);
		assertFields(`slug namespace ${namespace.id}`, stored, {
			id: namespace.id,
			name: namespace.slug,
		});
	}
}
