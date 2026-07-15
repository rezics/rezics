import { AccountAuthorization } from "./account/authorization";
import { CollectionAuthorization } from "./collection/authorization";
import { PlatformAuthorization } from "./platform/authorization";
import { RealmAuthorization } from "./realm/authorization";
import { UnitAuthorization } from "./unit/authorization";
import { UploadAuthorization } from "./upload/authorization";

/** Request-scoped authorization for one profile, including anonymous requests. */
export class Authorization<ProfileId extends string | undefined = string | undefined> {
	readonly account: AccountAuthorization<ProfileId>;
	readonly collection: CollectionAuthorization<ProfileId>;
	readonly platform: PlatformAuthorization<ProfileId>;
	readonly realm: RealmAuthorization<ProfileId>;
	readonly unit: UnitAuthorization<ProfileId>;
	readonly upload: UploadAuthorization<ProfileId>;

	constructor(readonly profileId: ProfileId) {
		this.account = new AccountAuthorization(profileId);
		this.collection = new CollectionAuthorization(profileId);
		this.platform = new PlatformAuthorization(profileId);
		this.realm = new RealmAuthorization(profileId, this.platform);
		this.unit = new UnitAuthorization(profileId, this.platform);
		this.upload = new UploadAuthorization(profileId);
	}
}
