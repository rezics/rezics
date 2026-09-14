import { eq, sql, type SQL } from "drizzle-orm";
import { users } from "../database/schema/auth";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
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
	const table = unitOwnerTable(reference.owner);
	const [row] = await tx.select({ id: table.id, deleted: table.deletedAt }).from(table).where(eq(table.id, reference.id)).for("share");
	if (!row || (change && row.deleted !== null)) throw new AccessRecordUnavailable();
	return sql<boolean>`exists(select 1 from ${table} where ${table.id}=${reference.id}::uuid ${change ? sql`and ${table.deletedAt} is null` : sql``})`;
}
