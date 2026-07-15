import { describe, expect, it, vi } from "vitest";

import { UploadKeyForbidden } from "../errors";
import { isManagedUploadKey, UploadAuthorization } from "./authorization";

describe("upload authorization", () => {
	it("scopes generated keys and ownership checks to one profile namespace", () => {
		vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
		const upload = new UploadAuthorization("profile-a");
		const key = upload.createKey("png");

		expect(key).toBe("profiles/profile-a/00000000-0000-4000-8000-000000000000.png");
		expect(upload.owns(key)).toBe(true);
		expect(upload.owns("profiles/profile-b/image.png")).toBe(false);
		expect(upload.owns("profiles/profile-a-prefix/image.png")).toBe(false);
		expect(upload.owns("users/profile-a/image.png")).toBe(false);
		expect(isManagedUploadKey(key)).toBe(true);
		expect(isManagedUploadKey("users/profile-a/image.png")).toBe(false);
		expect(() => upload.ensureOwn("profiles/profile-b/image.png")).toThrow(UploadKeyForbidden);
	});
});
