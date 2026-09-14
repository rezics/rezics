import { z } from "zod";
import { encryptOpaqueValue, decryptOpaqueValue } from "./opaque-values";
import { AccessInputInvalid } from "./http-errors";
import type { FirstPartyCredentialProof } from "../auth/credential-authority";
const payload = z.strictObject({ scopeId: z.uuid().toLowerCase(), issuedAt: z.number().int().nonnegative(), expiresAt: z.number().int().positive() })
	.refine(value => value.expiresAt > value.issuedAt && value.expiresAt - value.issuedAt <= 900_000);
function audience(proof: Readonly<FirstPartyCredentialProof>) {
	return Buffer.from(JSON.stringify([proof.principalId, proof.kind, proof.id]), "utf8");
}
/** Scope locators conceal private account roots and carry no management permission. @internal */
export function createScopeSelectors(secret: string) {
	const settings = { secret, keyContext: "rezics:management-scope:v1", prefix: "rzs1.", maximumLength: 512 };
	return {
		mint(scopeId: string, proof: Readonly<FirstPartyCredentialProof>, now: number) {
			const value = payload.parse({ scopeId, issuedAt: now, expiresAt: now + 900_000 });
			return encryptOpaqueValue(Buffer.from(JSON.stringify(value), "utf8"), audience(proof), settings);
		},
		resolve(value: string, proof: Readonly<FirstPartyCredentialProof>, now: number) {
			try {
				if (!Number.isSafeInteger(now) || now < 0) throw new AccessInputInvalid();
				const result = payload.parse(JSON.parse(decryptOpaqueValue(value, audience(proof), settings).toString("utf8")));
				if (result.issuedAt > now || result.expiresAt <= now) throw new AccessInputInvalid();
				return result.scopeId;
			} catch { throw new AccessInputInvalid(); }
		},
	};
}
