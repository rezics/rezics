import { describe, expect, it } from "vitest";

import { classifyPlatformCore, describePlatformCoreState } from "./core";
import {
	parsePlatformCredentialRotationCommand,
	parsePlatformInstallCommandOptions,
} from "./command-options";
import { BootstrapAccountIds, BootstrapAuthUserIds, BootstrapUnitIds } from "./data";

const allIdentityIds = new Set([
	...BootstrapUnitIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
]);

describe("platform core lifecycle", () => {
	it("distinguishes a new database from an occupied uninstalled database", () => {
		expect(classifyPlatformCore(new Set(), false)).toEqual({ status: "uninstalled" });
		expect(classifyPlatformCore(new Set(), true)).toEqual({ status: "occupied" });
	});

	it("accepts only a complete set of fixed identities", () => {
		expect(classifyPlatformCore(allIdentityIds, true)).toEqual({ status: "ready" });
		const [missingId, ...presentIds] = allIdentityIds;
		if (!missingId) throw new Error("Platform core identity manifest is empty");
		const state = classifyPlatformCore(new Set(presentIds), true);
		expect(state.status).toBe("incomplete");
		if (state.status !== "incomplete") throw new Error("Expected incomplete platform core");
		expect(state.missingIdentities).toContainEqual(expect.objectContaining({ id: missingId }));
		expect(describePlatformCoreState(state)).toContain(missingId);
	});

	it("requires explicit installation and credential-rotation confirmation", () => {
		expect(parsePlatformInstallCommandOptions(["--yes"])).toEqual({
			whenInstalled: "fail",
		});
		expect(parsePlatformInstallCommandOptions(["--if-needed", "--yes"])).toEqual({
			whenInstalled: "skip",
		});
		expect(() => parsePlatformInstallCommandOptions([])).toThrow(/without --yes/);
		expect(() => parsePlatformInstallCommandOptions(["--yes", "--unknown"])).toThrow(/Usage:/);
		expect(() => parsePlatformCredentialRotationCommand([])).toThrow(/Usage:/);
		expect(() => parsePlatformCredentialRotationCommand(["--yes"])).not.toThrow();
	});
});
