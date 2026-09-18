import { eq, sql, type SQL } from "drizzle-orm";
import { users } from "@rezics/schema/postgres/identity/auth";
import { unitOwnerTable } from "@rezics/schema/postgres/shared/unit-reference-columns";
import type { DatabaseTransaction } from "../database";
import { resolveReferenceValue } from "../units/reference-value";
import { resolveAccessScope } from "./identities";
import { AccessRecordUnavailable } from "./http-errors";

/** Retain native lifecycle fences for control-plane inspection or change; this is not access admission. @internal */
export async function scopeLifecycleAdmission(tx: DatabaseTransaction, scopeId: string, change: boolean): Promise<SQL<boolean | null>> {
	const target = await resolveAccessScope(tx, scopeId);
	if (!target) throw new AccessRecordUnavailable();
	if (target.kind === "platform") return sql<boolean>`true`;
	if (target.kind === "account") {
		const [account] = await tx.select({ erased: users.erasedAt }).from(users).where(eq(users.id, target.id)).for("share");
		if (!account || account.erased !== null) throw new AccessRecordUnavailable();
		return sql<boolean>`exists(select 1 from ${users} where ${users.id}=${target.id}::uuid and ${users.erasedAt} is null)`;
	}
	const reference = await resolveReferenceValue(tx, target.referenceValueId);
	if (!reference) throw new AccessRecordUnavailable();
	if (reference.owner === "entity") {
  await tx.execute(sql`select p.entity_id from public.entity_participation p join public.entity_identity e on e.id=p.entity_id where e.id=${reference.id}::uuid and e.shape='organization' for share of e,p`);
  const [kind] = (await tx.execute<{ shape: string }>(sql`select shape from public.entity_identity where id=${reference.id}::uuid`)).rows;
  if (kind?.shape === "organization") return sql<boolean>`public.access_membership_scope_is_eligible(${scopeId}::uuid)`;
 }
 const table = unitOwnerTable(reference.owner);
	const [row] = await tx.select({ id: table.id, deleted: table.deletedAt }).from(table).where(eq(table.id, reference.id)).for("share");
	if (!row || (change && row.deleted !== null)) throw new AccessRecordUnavailable();
	return sql<boolean>`exists(select 1 from ${table} where ${table.id}=${reference.id}::uuid ${change ? sql`and ${table.deletedAt} is null` : sql``})`;
}
