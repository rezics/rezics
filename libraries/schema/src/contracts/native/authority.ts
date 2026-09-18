import { z } from "zod";
/** @alpha Request and queued command identity, including the revision approved at admission. */
export const ParticipationAuthoritySchema = z.strictObject({
	principal: z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("auth"), authUserId: z.uuid() }),
		z.strictObject({
			kind: z.literal("service"),
			servicePrincipalId: z.uuid(),
			authUserId: z.uuid(),
		}),
	]),
	actingEntityId: z.uuid(),
	authorizationRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	grant: z
		.strictObject({
			id: z.uuid(),
			revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		})
		.optional(),
});
export type ParticipationAuthority = z.infer<typeof ParticipationAuthoritySchema>;

/** @internal Authenticated credential proof captured by the service. */
export type FirstPartyCredentialProof =
	| { kind: "session"; id: string; principalId: string; tokenDigest: string }
	| { kind: "api-key"; id: string; principalId: string; tokenDigest: string };
