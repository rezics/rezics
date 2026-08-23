import { sql } from "drizzle-orm";

import { database } from "../database";
import {
	assertPlatformCoreReady,
	decidePlatformEnsureAction,
	describePlatformCoreState,
	inspectPlatformCore,
	PlatformInstallationLockName,
} from "./core";
import type { IssuedPlatformCredential } from "./credentials";
import { BootstrapProfileIdValues, BootstrapRealmManifest } from "./data";
import { ensureOfficialZoneFollows } from "./official-zone-follows";
import { assertBootstrapManifest } from "./manifest-validation";
import { ensureDefaultApiQuotaPolicies } from "./installation/api-quotas";
import { ensureContentLabelRegistry } from "./installation/content-labels";
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

export type PlatformInstallationResult =
	| {
			readonly status: "installed";
			readonly issuedCredentials: readonly IssuedPlatformCredential[];
	  }
	| {
			readonly status: "already_installed";
			readonly issuedCredentials: readonly [];
	  };

async function ensurePlatform(): Promise<PlatformInstallationResult> {
	assertBootstrapManifest();
	return database.transaction(async (tx): Promise<PlatformInstallationResult> => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${PlatformInstallationLockName}, 0))`,
		);
		const initialState = await inspectPlatformCore(tx);
		if (decidePlatformEnsureAction(initialState) === "refuse-occupied") {
			if (initialState.status !== "occupied")
				throw new Error("Platform ensure occupied decision lost its state proof");
			throw new Error(
				`Platform ensure refuses an occupied database; ${describePlatformCoreState(initialState)}`,
			);
		}
		await ensureSlugNamespaces(tx);
		const issuedCredentials = await ensureBootstrapProfiles(tx);
		await ensureBootstrapProfileFavorites(tx);
		await ensureContentLabelRegistry(tx);
		await ensureCuratedCreationTagCollections(tx);
		await ensureBootstrapPlatformAccess(tx);
		await ensureDefaultApiQuotaPolicies(tx);
		await ensureOfficialRealmAvatar(tx);
		for (const realm of BootstrapRealmManifest) await ensureBootstrapRealm(tx, realm);
		await ensureScoreRealmProfileDefaults(tx);
		const createdZoneIds = await ensureOfficialZones(tx);
		await ensureOfficialZoneExperiences(tx, createdZoneIds);
		await ensureOfficialZoneFollows(tx, BootstrapProfileIdValues, {
			sequenceIsEmpty: initialState.status === "uninstalled",
		});
		assertPlatformCoreReady(await inspectPlatformCore(tx));
		if (initialState.status === "ready" && issuedCredentials.length === 0)
			return { status: "already_installed", issuedCredentials: [] };
		return { status: "installed", issuedCredentials };
	});
}

/**
 * Ensures reserved platform identities. Missing IDs receive starter content once.
 * Existing product-owned fields are never overwritten.
 */
export class PlatformInstallationService {
	isInitialBundleReady(): Promise<boolean> {
		return isInitialInstallationBundleReady();
	}

	install(): Promise<PlatformInstallationResult> {
		return ensurePlatform();
	}
}

export const platformInstallationService = new PlatformInstallationService();
