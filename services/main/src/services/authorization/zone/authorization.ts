import {
	DevelopmentPreviewCapability,
	ZonePagesManagePermission,
	ZoneThemeManagePermission,
} from "@rezics/access";

import type { PlatformAuthorization } from "../platform/authorization";
import type { UnitAuthorization } from "../unit/authorization";

/** Release state of the Zone theme vocabulary used by a mutation. */
export const ZoneThemeMutationReleaseValues = ["released", "development_preview"] as const;
export type ZoneThemeMutationRelease = (typeof ZoneThemeMutationReleaseValues)[number];

export type ZoneThemeAccess = {
	readonly canManageTheme: boolean;
	readonly hasDevelopmentPreviewAccess: boolean;
};

/** Actor-bound authorization for Zone-specific operations. */
export class ZoneAuthorization<ProfileId extends string | undefined> {
	constructor(
		private readonly platform: PlatformAuthorization<ProfileId>,
		private readonly unit: UnitAuthorization<ProfileId>,
	) {}

	async canManagePages(zoneId: string): Promise<boolean> {
		return (await this.unit.decide(zoneId, ZonePagesManagePermission)).allowed;
	}

	/** Requires Zone page-composition authority, including navigation mutations. */
	async ensurePagesMutation(this: ZoneAuthorization<string>, zoneId: string): Promise<void> {
		await this.unit.ensure(zoneId, ZonePagesManagePermission);
	}

	/** Returns the independent ordinary and preview decisions used by Zone management UI. */
	async getThemeAccess(zoneId: string): Promise<ZoneThemeAccess> {
		const [themeDecision, hasDevelopmentPreviewAccess] = await Promise.all([
			this.unit.decide(zoneId, ZoneThemeManagePermission),
			this.platform.hasCapability(DevelopmentPreviewCapability),
		]);
		return {
			canManageTheme: themeDecision.allowed,
			hasDevelopmentPreviewAccess,
		};
	}

	async canManageTheme(zoneId: string): Promise<boolean> {
		return (await this.unit.decide(zoneId, ZoneThemeManagePermission)).allowed;
	}

	/**
	 * Requires the independently delegable Zone theme permission and, for
	 * unreleased token vocabularies and presets, the platform preview gate.
	 */
	async ensureThemeMutation(
		this: ZoneAuthorization<string>,
		zoneId: string,
		release: ZoneThemeMutationRelease,
	): Promise<void> {
		if (release === "development_preview")
			await this.platform.ensureCapability(DevelopmentPreviewCapability);
		await this.unit.ensure(zoneId, ZoneThemeManagePermission);
	}
}
