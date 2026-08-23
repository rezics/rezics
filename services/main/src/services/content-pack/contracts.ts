import type {
	IdLedger,
	PackBinding,
	PackManifest,
	PackObject,
	PackRelations,
	PackStructure,
	RightsRecord,
	SourceLock,
} from "./schemas";

export type {
	IdLedger,
	PackBinding,
	PackContentLanguageSupportEntry,
	PackLocalization,
	PackManifest,
	PackObject,
	PackRelations,
	PackStructure,
	RightsRecord,
	SourceLock,
} from "./schemas";

export const ContentPackCommandValues = ["plan", "apply", "verify", "status"] as const;
export type ContentPackCommand = (typeof ContentPackCommandValues)[number];

export const DefaultContentPackBundleId = "showcase-real-v1";

export type ContentPackRunOptions = {
	readonly command: ContentPackCommand;
	readonly from?: string;
	readonly packId?: string;
	readonly bundleId?: string;
};

export type LoadedPack = {
	readonly packDir: string;
	readonly manifest: PackManifest;
	readonly checksum: string;
	readonly ids: IdLedger;
	readonly rights: readonly RightsRecord[];
	readonly sourceLock: SourceLock;
	readonly bindings: readonly PackBinding[];
	readonly objects: readonly PackObject[];
	readonly relations: PackRelations;
	readonly structures: readonly PackStructure[];
};

export type PlannedObject =
	| { readonly sourceKey: string; readonly unitId: string; readonly action: "create" }
	| { readonly sourceKey: string; readonly unitId: string; readonly action: "noop" }
	| {
			readonly sourceKey: string;
			readonly unitId: string;
			readonly action: "conflict";
			readonly reason: string;
	  };

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
	if (!isContentPackCommand(command))
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
		command,
		...(from ? { from } : {}),
		...(packId ? { packId } : {}),
		...(bundleId ? { bundleId } : {}),
	};
}

function isContentPackCommand(value: string | undefined): value is ContentPackCommand {
	return ContentPackCommandValues.some((candidate) => candidate === value);
}
