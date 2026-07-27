import { RealmRuleRevisionChanged } from "./errors";

export function requireCurrentRealmRuleRevision(
	requestedRevisionId: string,
	currentRevisionId: string | undefined,
): string {
	if (requestedRevisionId !== currentRevisionId)
		throw new RealmRuleRevisionChanged({
			currentRevisionId: currentRevisionId ?? null,
		});
	return currentRevisionId;
}
