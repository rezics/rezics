import { afterEach, describe, expect, it, vi } from "vitest";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
} from "./native-enrollment-fixture";

afterEach(() => vi.unstubAllEnvs());

describe("native enrollment fixture boundary", () => {
	it.each([
		"postgres://postgres:postgres@remote.invalid:5433/rezics_atlas",
		"postgres://postgres:postgres@127.0.0.1:15432/rezics_atlas",
		"postgres://postgres:postgres@127.0.0.1:5433/rezics",
		"https://127.0.0.1/rezics_atlas",
	])("rejects non-disposable destination %s", (url) => {
		vi.stubEnv("DATABASE_URL", url);
		vi.stubEnv("REZICS_DISPOSABLE_MIGRATION_FIXTURE", "1");
		expect(() => assertNativeEnrollmentFixture()).toThrow("isolated loopback Atlas");
	});
	it("requires the explicit fixture flag even on a loopback fixture database", () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://postgres:postgres@127.0.0.1:55433/rezics_atlas_enrollment",
		);
		vi.stubEnv("REZICS_DISPOSABLE_MIGRATION_FIXTURE", "");
		expect(() => assertNativeEnrollmentFixture()).toThrow("explicit disposable target");
	});
	it("captures private credential evidence without serializing the token or its digest", () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://postgres:postgres@127.0.0.1:55433/rezics_atlas_enrollment",
		);
		vi.stubEnv("REZICS_DISPOSABLE_MIGRATION_FIXTURE", "1");
		const session = {
			id: "019f9ea5-5188-7f3a-8819-380ec28c0b11",
			userId: "019f9ea5-5188-7f3a-8819-380ec28c0b12",
			token: "private-fixture-token",
		};
		const context = fixturePrincipalContext(session);
		expect(context.principalId).toBe(session.userId);
		expect(context.selection).toEqual({ mode: "direct" });
		expect(context.credentialProof().id).toBe(session.id);
		expect(JSON.stringify(context)).not.toContain(session.token);
		expect(JSON.stringify(context)).not.toContain(context.credentialProof().tokenDigest);
	});
});
