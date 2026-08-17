export const ContentPackCommandValues = ["plan", "apply", "verify", "status"] as const;
export type ContentPackCommand = (typeof ContentPackCommandValues)[number];

export const DefaultContentPackBundleId = "showcase-real-v1";

export type ContentPackRunOptions = {
	readonly command: ContentPackCommand;
	readonly from?: string;
	readonly packId?: string;
	readonly bundleId?: string;
};

export type PackManifest = {
	readonly id: string;
	readonly version: string;
	readonly title?: string;
	readonly phase?: string;
	readonly minRezicsVersion?: string;
};

export type IdLedger = {
	readonly units: Record<string, string>;
	readonly structures?: Record<string, string>;
	readonly nodes?: Record<string, string>;
	readonly aliases?: Record<string, string>;
	readonly credits?: Record<string, string>;
	readonly subjects?: Record<string, string>;
};

export type RightsRecord = {
	readonly sourceKey: string;
	readonly rightsBasis?: string;
	readonly jurisdiction?: string | null;
	readonly attributionText?: string | null;
	readonly payloadSha256?: string;
};

export type PackLocalization = {
	readonly language: string;
	readonly title: string;
	readonly summary?: string;
	readonly description?: unknown;
	readonly content?: unknown;
	readonly contentStatus?: "draft" | "published" | "archived";
};

export type PackObject = {
	readonly sourceKey: string;
	readonly unit: {
		readonly kind: string;
		readonly status: "draft" | "published" | "archived";
		readonly visibility: "public" | "unlisted" | "private";
		readonly contentRating: "general" | "r15" | "r18" | "r18g";
		readonly aiDisclosure: string;
		readonly license: string | null;
		readonly moderationStatus: "approved" | "pending" | "removed";
		readonly postTargetingLocked: boolean;
	};
	readonly import: {
		readonly ownershipMode: "profile_owned" | "community_owned";
		readonly actorKind: "import";
	};
	readonly entity?: { readonly kind: string; readonly verified: boolean };
	readonly book?: {
		readonly releaseStatus: "ongoing" | "hiatus" | "completed" | "cancelled";
		readonly isbn13?: string;
		readonly publicationDate?: string;
		readonly pageCount?: number;
	};
	readonly media?: {
		readonly kind: string;
		readonly releaseStatus: "ongoing" | "hiatus" | "completed" | "cancelled";
		readonly releaseDate?: string;
		readonly episodeCount?: number;
		readonly seasonCount?: number;
		readonly runtimeMinutes?: number;
	};
	readonly series?: { readonly kind: string };
	readonly realm?: {
		readonly joinPolicy: "open" | "approval";
		readonly realmTagVotingEnabled: boolean;
		readonly enabledPages: readonly string[];
	};
	readonly zone?: {
		readonly slug: string;
		readonly filterTagSourceKey?: string;
		readonly filterUnitKind?: "book" | "media";
		readonly themeAccent?: string;
		readonly homePageSourceKey?: string;
		readonly localRuleRealmSourceKey?: string;
	};
	readonly compiledZone?: {
		readonly slug: string;
		readonly filterDocument: unknown;
		readonly themeDocument: unknown;
		readonly localRuleRealmSourceKey: string;
	};
	readonly zonePage?: { readonly zoneSourceKey: string };
	readonly post?: { readonly kind: string; readonly subjectSourceKey: string | null };
	readonly localizations: readonly PackLocalization[];
	readonly aliases?: readonly {
		readonly sourceKey: string;
		readonly term: string;
		readonly normalizedTerm: string;
		readonly language: string | null;
		readonly kind: string;
		readonly pinned: boolean;
	}[];
};

export type PackRelations = {
	readonly credits?: readonly {
		readonly sourceKey: string;
		readonly sourceUnitSourceKey: string;
		readonly creditedUnitSourceKey: string;
		readonly role: string;
		readonly position: string;
	}[];
	readonly subjects?: readonly {
		readonly sourceKey: string;
		readonly unitSourceKey: string;
		readonly entitySourceKey: string;
		readonly role: string;
		readonly contextPostSourceKey: string | null;
		readonly position: string;
	}[];
	readonly seriesReleases?: readonly {
		readonly seriesSourceKey: string;
		readonly releaseUnitSourceKey: string;
		readonly position: string;
		readonly releasedOn: string | null;
	}[];
	readonly collectionItems?: readonly {
		readonly collectionSourceKey: string;
		readonly unitSourceKey: string;
		readonly position: string;
	}[];
	readonly unitTags?: readonly {
		readonly unitSourceKey: string;
		readonly tagSourceKey: string;
		readonly pinned: boolean;
		readonly position: string | null;
	}[];
	readonly realmUnits?: readonly {
		readonly realmSourceKey: string;
		readonly unitSourceKey: string;
		readonly status: "visible";
		readonly publicationState: "active";
	}[];
	readonly slugs?: readonly {
		readonly kind: "canonical";
		readonly scope: "zones" | "realms" | "entities" | "tags" | "users";
		readonly slug: string;
		readonly targetSourceKey: string;
	}[];
};

export type PackStructure = {
	readonly sourceKey: string;
	readonly ownerUnitSourceKey: string;
	readonly kind: string;
	readonly nodes: readonly {
		readonly sourceKey: string;
		readonly parentSourceKey: string | null;
		readonly contentUnitSourceKey: string;
		readonly targetKind: "content" | "none" | "unit" | "external";
		readonly targetUnitSourceKey?: string;
		readonly position: string;
	}[];
};

export type LoadedPack = {
	readonly packDir: string;
	readonly manifest: PackManifest;
	readonly checksum: string;
	readonly ids: IdLedger;
	readonly rights: readonly RightsRecord[];
	readonly objects: readonly PackObject[];
	readonly relations: PackRelations;
	readonly structures: readonly PackStructure[];
};

export type PlannedObject =
	| { readonly sourceKey: string; readonly unitId: string; readonly action: "create" }
	| { readonly sourceKey: string; readonly unitId: string; readonly action: "noop" }
	| { readonly sourceKey: string; readonly unitId: string; readonly action: "conflict"; readonly reason: string };

export type ContentPackPlan = {
	readonly packId: string;
	readonly version: string;
	readonly checksum: string;
	readonly sourceRoot: string;
	readonly alreadyInstalled: boolean;
	readonly objects: readonly PlannedObject[];
	readonly createCount: number;
	readonly noopCount: number;
	readonly conflicts: readonly PlannedObject[];
};

export function parseContentPackRunOptions(arguments_: readonly string[]): ContentPackRunOptions {
	const [command, ...rest] = arguments_;
	if (!command || !ContentPackCommandValues.includes(command as ContentPackCommand))
		throw new TypeError(
			"Usage: content-pack.ts <plan|apply|verify|status> [--from DIR] [--pack ID] [--bundle ID]",
		);
	let from: string | undefined;
	let packId: string | undefined;
	let bundleId: string | undefined;
	for (let index = 0; index < rest.length; index += 1) {
		const flag = rest[index];
		const value = rest[index + 1];
		if (flag === "--from") {
			if (!value) throw new TypeError("--from requires a directory");
			from = value;
			index += 1;
			continue;
		}
		if (flag === "--pack") {
			if (!value) throw new TypeError("--pack requires a pack id");
			packId = value;
			index += 1;
			continue;
		}
		if (flag === "--bundle") {
			if (!value) throw new TypeError("--bundle requires a bundle id");
			bundleId = value;
			index += 1;
			continue;
		}
		throw new TypeError(`Unknown argument: ${flag}`);
	}
	return {
		command: command as ContentPackCommand,
		...(from ? { from } : {}),
		...(packId ? { packId } : {}),
		...(bundleId ? { bundleId } : {}),
	};
}
