import { sql, type SQLWrapper } from "drizzle-orm";
import { authEntity } from "../database/schema/participation";

/**
 * Private identity traversal for applying an author's personal visibility policy.
 * A cataloged organization has no self binding and cannot expose another account's preferences.
 * @internal
 */
export function selfAuthUserIdForEntity(entityId: string | SQLWrapper) {
	return sql<string | null>`(select ${authEntity.authUserId} from ${authEntity}
		where ${authEntity.entityId} = ${entityId} and ${authEntity.state} = 'active')`;
}
