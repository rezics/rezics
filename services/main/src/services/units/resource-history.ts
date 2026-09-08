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
import { ParticipationDenied } from "../participation/policy";
import { CatalogAccessDenied, loadCatalogIdentity } from "../catalog/storage";
import type { UnitAuthorization } from "../authorization/unit/authorization";
import type { UnitScope } from "../authorization/unit/scope";

/** Native resource curation uses catalog authority; platform resource curation retains its scoped permission. */
export async function ensureResourceUpdateAllowed(tx:DatabaseTransaction,authorization:UnitAuthorization<string>,unitId:string,scope:UnitScope) {
	const state=await readUnitStateById(tx,unitId);
	if(!state) throw new UnitNotFound();
	const native=CatalogReferenceSchema.safeParse(state.reference);
	if(!native.success) return authorization.ensureInTransaction(tx,unitId,"unit.update",scope);
	const authority=authorization.participationAuthority;
	if(!authority) throw new AuthenticationRequired();
	try { await runWithParticipationAuthority(authority,()=>loadCatalogIdentity(tx,native.data,authority.principal.authUserId,true)); }
	catch(cause) { if(cause instanceof CatalogAccessDenied) throw new ParticipationDenied(); throw cause; }
}
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
