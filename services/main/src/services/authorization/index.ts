import { AccountAuthorization } from "./account/authorization";
import { CollectionAuthorization } from "./collection/authorization";
import { EntityAuthorization } from "./entity/authorization";
import { PlatformAuthorization } from "./platform/authorization";
import { RealmAuthorization } from "./realm/authorization";
import { UnitAuthorization } from "./unit/authorization";

/** Request-scoped authorization for one profile, including anonymous requests. */
export class Authorization<ProfileId extends string | undefined = string | undefined> {
	readonly account: AccountAuthorization<ProfileId>;
	readonly collection: CollectionAuthorization<ProfileId>;
	readonly entity: EntityAuthorization<ProfileId>;
	readonly platform: PlatformAuthorization<ProfileId>;
	readonly realm: RealmAuthorization<ProfileId>;
	readonly unit: UnitAuthorization<ProfileId>;

	constructor(readonly profileId: ProfileId) {
		this.account = new AccountAuthorization(profileId);
		this.collection = new CollectionAuthorization(profileId);
		this.platform = new PlatformAuthorization(profileId);
		this.unit = new UnitAuthorization(profileId, this.platform);
		this.entity = new EntityAuthorization(profileId, this.platform, this.unit);
		this.realm = new RealmAuthorization(profileId, this.platform);
	}
}
