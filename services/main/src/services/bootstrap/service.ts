import { sql } from "drizzle-orm";

import { database } from "../database";
import {
	assertPlatformCoreReady,
	describePlatformCoreState,
	inspectPlatformCore,
	PlatformInstallationLockName,
} from "./core";
import type { IssuedPlatformCredential } from "./credentials";
import { BootstrapProfileIdValues, BootstrapRealmManifest } from "./data";
import { ensureOfficialZoneFollows } from "./official-zone-follows";
import { assertBootstrapManifest } from "./manifest-validation";
import { ensureDefaultApiQuotaPolicies } from "./installation/api-quotas";
import { ensureCuratedCreationTagCollections } from "./installation/collections";
import { ensureSlugNamespaces } from "./installation/foundation";
import { ensureBootstrapPlatformAccess } from "./installation/platform-access";
import { ensureBootstrapProfileFavorites, ensureBootstrapProfiles } from "./installation/profiles";
import {
	ensureBootstrapRealm,
	ensureOfficialRealmAvatar,
	ensureScoreRealmProfileDefaults,
} from "./installation/realms";
import { ensureOfficialZoneExperiences, ensureOfficialZones } from "./installation/zones";
import { isInitialInstallationBundleReady } from "./readiness";

export { ensureCuratedCreationTagCollections };

export interface PlatformInstallationOptions {
	readonly whenInstalled: "fail" | "skip";
}

export type PlatformInstallationResult =
	| {
			readonly status: "installed";
			readonly issuedCredentials: readonly IssuedPlatformCredential[];
	  }
	| {
			readonly status: "already_installed";
			readonly issuedCredentials: readonly [];
	  };

async function installPlatform(
	options: PlatformInstallationOptions,
): Promise<PlatformInstallationResult> {
	assertBootstrapManifest();
	return database.transaction(async (tx): Promise<PlatformInstallationResult> => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${PlatformInstallationLockName}, 0))`,
		);
		const initialState = await inspectPlatformCore(tx);
		if (initialState.status === "ready") {
			if (options.whenInstalled === "skip")
				return { status: "already_installed", issuedCredentials: [] };
			throw new Error("Platform installation is already complete");
		}
		if (initialState.status !== "uninstalled")
			throw new Error(
				`Platform installation requires an empty database; ${describePlatformCoreState(initialState)}`,
			);
		await ensureSlugNamespaces(tx);
		const issuedCredentials = await ensureBootstrapProfiles(tx);
		await ensureBootstrapProfileFavorites(tx);
		await ensureCuratedCreationTagCollections(tx);
		await ensureBootstrapPlatformAccess(tx);
		await ensureDefaultApiQuotaPolicies(tx);
		await ensureOfficialRealmAvatar(tx);
		for (const realm of BootstrapRealmManifest) await ensureBootstrapRealm(tx, realm);
		await ensureScoreRealmProfileDefaults(tx);
		await ensureOfficialZones(tx);
		await ensureOfficialZoneExperiences(tx);
		await ensureOfficialZoneFollows(tx, BootstrapProfileIdValues, { sequenceIsEmpty: true });
		assertPlatformCoreReady(await inspectPlatformCore(tx));
		return { status: "installed", issuedCredentials };
	});
}

/**
 * Installs the versioned factory bundle exactly once. Product-owned fields are
 * handed to the platform after this operation and are never reconciled here.
 */
export class PlatformInstallationService {
	isInitialBundleReady(): Promise<boolean> {
		return isInitialInstallationBundleReady();
	}

	install(options: PlatformInstallationOptions): Promise<PlatformInstallationResult> {
		return installPlatform(options);
	}
}

export const platformInstallationService = new PlatformInstallationService();
