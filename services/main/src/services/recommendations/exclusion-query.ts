import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { recommendationExclusion, authEntity } from "../database/schema";
import { referenceValue } from "../database/schema/reference-value";
import { unitReferenceIdExpression } from "../database/schema/unit-reference-columns";

const reference = alias(referenceValue, "recommendation_excluded_reference");
const binding = alias(authEntity, "recommendation_exclusion_account");

/** Account-private exclusion predicate over a native ID; never an authorization oracle. @internal */
export function recommendationExclusionCondition(
	targetId: SQLWrapper,
	authUserId: string | SQLWrapper,
): SQL {
	return sql`exists (
  select 1 from ${recommendationExclusion}
  join ${referenceValue} recommendation_excluded_reference
    on ${reference.id} = ${recommendationExclusion.targetReferenceId}
  join ${authEntity} recommendation_exclusion_account
    on ${binding.authUserId} = ${recommendationExclusion.authUserId}
  where ${recommendationExclusion.authUserId} = ${authUserId}::uuid
    and ${binding.state} = 'active'
    and ${unitReferenceIdExpression("target", reference)} = ${targetId}
 )`;
}
