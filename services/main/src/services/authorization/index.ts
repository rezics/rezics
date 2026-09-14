import { AccountAuthorization } from "./account/authorization";
import { CollectionAuthorization } from "./collection/authorization";
import { EntityAuthorization } from "./entity/authorization";
import { PlatformAuthorization } from "./platform/authorization";
import { RealmAuthorization } from "./realm/authorization";
import { UnitAuthorization } from "./unit/authorization";
import { ZoneAuthorization } from "./zone/authorization";
import type { ParticipationAuthority } from "../participation/policy";
import type { FirstPartyCredentialProof } from "../auth/credential-authority";

/** Request-scoped authorization for one profile, including anonymous requests. */
export class Authorization<ProfileId extends string | undefined = string | undefined> {
	readonly #firstPartyCredential: Readonly<FirstPartyCredentialProof> | undefined;
	readonly account: AccountAuthorization<string | undefined>;
	readonly collection: CollectionAuthorization<ProfileId>;
	readonly entity: EntityAuthorization<ProfileId>;
	readonly platform: PlatformAuthorization<ProfileId>;
	readonly realm: RealmAuthorization<ProfileId>;
	readonly unit: UnitAuthorization<ProfileId>;
	readonly zone: ZoneAuthorization<ProfileId>;

	constructor(
		readonly profileId: ProfileId,
		readonly authUserId?: string,
		readonly participationAuthority?: ParticipationAuthority,
		firstPartyCredential?: FirstPartyCredentialProof,
	) {
		if (firstPartyCredential && firstPartyCredential.principalId !== authUserId)
			throw new Error("Credential proof does not match the authenticated principal");
		this.#firstPartyCredential = firstPartyCredential ? Object.freeze({ ...firstPartyCredential }) : undefined;
		this.account = new AccountAuthorization(authUserId);
		this.collection = new CollectionAuthorization(profileId);
		this.platform = new PlatformAuthorization(profileId, authUserId);
		this.unit = new UnitAuthorization(profileId, this.platform, authUserId, participationAuthority);
		this.zone = new ZoneAuthorization(this.platform, this.unit);
		this.entity = new EntityAuthorization(profileId, this.platform, this.unit);
		this.realm = new RealmAuthorization(profileId, this.platform, this.unit);
	}

	/** Private authenticated proof for current native effects; never serialize it into API responses or logs. @internal */
	firstPartyCredentialProof(): Readonly<FirstPartyCredentialProof> {
		if (!this.#firstPartyCredential) throw new Error("Authenticated first-party credential proof is unavailable");
		return this.#firstPartyCredential;
	}
}
