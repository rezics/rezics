import { UploadKeyForbidden } from "../errors";

export function isManagedUploadKey(key: string) {
	return key.startsWith("profiles/");
}

export class UploadAuthorization<ProfileId extends string | undefined> {
	constructor(readonly profileId: ProfileId) {}

	createKey(this: UploadAuthorization<string>, extension: string) {
		return `profiles/${this.profileId}/${crypto.randomUUID()}.${extension}`;
	}

	owns(this: UploadAuthorization<string>, key: string) {
		return key.startsWith(`profiles/${this.profileId}/`);
	}

	ensureOwn(this: UploadAuthorization<string>, key: string): void {
		if (!this.owns(key)) throw new UploadKeyForbidden();
	}
}
