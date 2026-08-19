export const LicenseIds = [
	"cc-by-nc-sa-4.0",
	"cc-by-sa-4.0",
	"cc-by-sa-3.0",
	"all-rights-reserved",
	"cc-by-nc-4.0",
	"cc-by-4.0",
	"cc0-1.0",
	"pdm-1.0",
	"rezics-unit-content-license-v1-1",
] as const;

export type LicenseId = (typeof LicenseIds)[number];

export const ResidualRightsLicenseId = "all-rights-reserved" satisfies LicenseId;
export const RecommendedLicenseId = "rezics-unit-content-license-v1-1" satisfies LicenseId;

export const LicenseLegalFormValues = [
	"license",
	"public-domain-dedication",
	"public-domain-mark",
	"rights-reservation",
] as const;
export type LicenseLegalForm = (typeof LicenseLegalFormValues)[number];

export const LicenseRecognitionStatusValues = ["recognized", "invalidated"] as const;
export type LicenseRecognitionStatus = (typeof LicenseRecognitionStatusValues)[number];

export type LicenseDefinition<Id extends LicenseId = LicenseId> = {
	readonly id: Id;
	readonly legalForm: LicenseLegalForm;
	readonly termsUrl: string | null;
	readonly spdxId: string | null;
	readonly ownerMayEndOffering: boolean;
	readonly requiresAffirmativeAcknowledgement: boolean;
	/** `null` means the License applies to every Unit kind. */
	readonly applicableUnitKinds: readonly string[] | null;
};

const RezicsLicenseTermsOrigin = "https://about.rezics.com/en/legal";

export function rezicsLicenseTermsUrl(id: Extract<LicenseId, `rezics-${string}`>): string {
	return `${RezicsLicenseTermsOrigin}/${id}`;
}

export const LicenseRegistry = {
	"cc-by-nc-sa-4.0": {
		id: "cc-by-nc-sa-4.0",
		legalForm: "license",
		termsUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
		spdxId: "CC-BY-NC-SA-4.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"cc-by-sa-4.0": {
		id: "cc-by-sa-4.0",
		legalForm: "license",
		termsUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
		spdxId: "CC-BY-SA-4.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"cc-by-sa-3.0": {
		id: "cc-by-sa-3.0",
		legalForm: "license",
		termsUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
		spdxId: "CC-BY-SA-3.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"all-rights-reserved": {
		id: "all-rights-reserved",
		legalForm: "rights-reservation",
		termsUrl: null,
		spdxId: null,
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"cc-by-nc-4.0": {
		id: "cc-by-nc-4.0",
		legalForm: "license",
		termsUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
		spdxId: "CC-BY-NC-4.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"cc-by-4.0": {
		id: "cc-by-4.0",
		legalForm: "license",
		termsUrl: "https://creativecommons.org/licenses/by/4.0/",
		spdxId: "CC-BY-4.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"cc0-1.0": {
		id: "cc0-1.0",
		legalForm: "public-domain-dedication",
		termsUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
		spdxId: "CC0-1.0",
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"pdm-1.0": {
		id: "pdm-1.0",
		legalForm: "public-domain-mark",
		termsUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
		spdxId: null,
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: false,
		applicableUnitKinds: null,
	},
	"rezics-unit-content-license-v1-1": {
		id: "rezics-unit-content-license-v1-1",
		legalForm: "license",
		termsUrl: rezicsLicenseTermsUrl("rezics-unit-content-license-v1-1"),
		spdxId: null,
		ownerMayEndOffering: true,
		requiresAffirmativeAcknowledgement: true,
		applicableUnitKinds: null,
	},
} as const satisfies { readonly [Id in LicenseId]: LicenseDefinition<Id> };

export function isLicenseId(value: unknown): value is LicenseId {
	return typeof value === "string" && Object.hasOwn(LicenseRegistry, value);
}

export function parseLicenseId(value: unknown): LicenseId {
	if (!isLicenseId(value)) throw new TypeError("Unknown License ID");
	return value;
}

export function parseNullableLicenseId(value: unknown): LicenseId | null {
	return value === null ? null : parseLicenseId(value);
}
