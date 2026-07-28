import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = deTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Nicht kommerziell–Weitergabe unter gleichen Bedingungen 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Weitergabe unter gleichen Bedingungen 4.0 International`,
	},
	"all-rights-reserved": { label: "Alle Rechte vorbehalten" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Nicht kommerziell 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universell` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Nicht angegeben",
	viewTerms: `Bedingungen der ${publicationLicenseTerms.inline} anzeigen`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
