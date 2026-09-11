import type { RealmMemberStateValues } from "../database/schema/contract-values";

/** Roster output and candidate-work limits are independent bounds. @internal */
export const RealmRosterPageLimit = 100;
export const RealmRosterCandidateLimit = 512;

/** Live keyset traversal of one authorized Realm roster. @internal */
export interface RealmRosterQuery {
	readonly profileId?: string;
	readonly state?: (typeof RealmMemberStateValues)[number];
	readonly afterProfileId?: string;
	readonly localizationLanguages?: readonly string[];
	readonly limit?: number;
}
