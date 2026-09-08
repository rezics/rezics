import { CatalogReferenceSchema } from "@rezics/reference";
import type { Authorization } from "../authorization";
import { AuthenticationRequired } from "../auth/errors";
import type { DatabaseTransaction } from "../database";
import { UnitNotFound } from "./errors";
import { recordUnitRevision } from "./history";
import { readUnitStateById } from "./query";
import { recordCatalogChange } from "../catalog/storage";
import { withCatalogViewerPolicy } from "../catalog/read-policy";
import { runWithParticipationAuthority } from "../participation/policy";
/** Shared reference/association curation uses the owning native or platform ledger. */
export async function recordResourceRevision(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	input: Parameters<typeof recordUnitRevision>[1],
) {
	const current = await readUnitStateById(tx, input.unitId, { lock: "update" });
	if (!current) throw new UnitNotFound();
	const native = CatalogReferenceSchema.safeParse(current.reference);
	if (!native.success) {
		await recordUnitRevision(tx, { ...input, actorProfileId: authorization.profileId });
		return;
	}
	const actor = authorization.authUserId;
	if (!actor) throw new AuthenticationRequired();
	const write = () =>
		withCatalogViewerPolicy(tx, actor, () =>
			recordCatalogChange(tx, native.data, actor, current.revision, "resource.reference.change"),
		);
	if (authorization.participationAuthority)
		await runWithParticipationAuthority(authorization.participationAuthority, write);
	else await write();
}
