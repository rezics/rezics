export const PublicationLicenseIds = [
	"cc-by-nc-sa-4.0",
	"cc-by-sa-4.0",
	"all-rights-reserved",
	"cc-by-nc-4.0",
	"cc-by-4.0",
	"cc0-1.0",
] as const;

export type PublicationLicenseId = (typeof PublicationLicenseIds)[number];

type LicenseDefinition<Id extends PublicationLicenseId> = {
	readonly kind: "license";
	readonly id: Id;
	readonly url: string;
	readonly spdxId: string | null;
};

type RightsReservedDefinition = {
	readonly kind: "rights-reserved";
	readonly id: "all-rights-reserved";
	readonly url: null;
	readonly spdxId: null;
};

export type PublicationLicenseDefinition<Id extends PublicationLicenseId> =
	Id extends "all-rights-reserved" ? RightsReservedDefinition : LicenseDefinition<Id>;

export const PublicationLicenseRegistry = {
	"cc-by-nc-sa-4.0": {
		kind: "license",
		id: "cc-by-nc-sa-4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
		spdxId: "CC-BY-NC-SA-4.0",
	},
	"cc-by-sa-4.0": {
		kind: "license",
		id: "cc-by-sa-4.0",
		url: "https://creativecommons.org/licenses/by-sa/4.0/",
		spdxId: "CC-BY-SA-4.0",
	},
	"all-rights-reserved": {
		kind: "rights-reserved",
		id: "all-rights-reserved",
		url: null,
		spdxId: null,
	},
	"cc-by-nc-4.0": {
		kind: "license",
		id: "cc-by-nc-4.0",
		url: "https://creativecommons.org/licenses/by-nc/4.0/",
		spdxId: "CC-BY-NC-4.0",
	},
	"cc-by-4.0": {
		kind: "license",
		id: "cc-by-4.0",
		url: "https://creativecommons.org/licenses/by/4.0/",
		spdxId: "CC-BY-4.0",
	},
	"cc0-1.0": {
		kind: "license",
		id: "cc0-1.0",
		url: "https://creativecommons.org/publicdomain/zero/1.0/",
		spdxId: "CC0-1.0",
	},
} as const satisfies {
	readonly [Id in PublicationLicenseId]: PublicationLicenseDefinition<Id>;
};

export function isPublicationLicenseId(value: unknown): value is PublicationLicenseId {
	return typeof value === "string" && Object.hasOwn(PublicationLicenseRegistry, value);
}

export function parsePublicationLicenseId(value: unknown): PublicationLicenseId {
	if (!isPublicationLicenseId(value)) throw new TypeError("Unknown publication license ID");
	return value;
}

export function parseNullablePublicationLicenseId(value: unknown): PublicationLicenseId | null {
	return value === null ? null : parsePublicationLicenseId(value);
}
