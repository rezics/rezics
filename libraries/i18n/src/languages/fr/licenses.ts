import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = frTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Pas d’Utilisation Commerciale–Partage dans les Mêmes Conditions 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Partage dans les Mêmes Conditions 4.0 International`,
	},
	"all-rights-reserved": { label: "Tous droits réservés" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Pas d’Utilisation Commerciale 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Attribution 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universel` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Non précisée",
	viewTerms: `Voir les conditions de la ${publicationLicenseTerms.inline}`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
