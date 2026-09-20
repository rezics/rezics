import type { RequestedAuthoritySelection } from "@rezics/access";
import type { FirstPartyCredentialProof } from "@rezics/schema/contracts/native/authority";
import { AuthenticationRequired } from "./errors";

/**
 * Private request evidence shared by domain commands and workers without HTTP bootstrap.
 * @internal
 * @remarks Construction binds the principal to a captured proof; it grants no authority.
 * Every protected effect revalidates the stored credential and selected authority.
 * Credential digests cannot appear through object serialization.
 */
export class PrincipalRequestContext {
	readonly #proof: FirstPartyCredentialProof;
	constructor(
		readonly principalId: string,
		readonly selection: RequestedAuthoritySelection,
		proof: FirstPartyCredentialProof,
	) {
		if (proof.principalId !== principalId) throw new AuthenticationRequired();
		this.#proof = Object.freeze({ ...proof });
	}
	/** Revalidate this proof inside every protected effect's transaction. @internal */
	credentialProof(): Readonly<FirstPartyCredentialProof> {
		return this.#proof;
	}
}
