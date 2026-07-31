import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
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

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "Non précisée",
	viewTerms: `Voir les conditions de la ${publicationLicenseTerms.inline}`,
	options,
	unitContent: {
		none: "Aucune",
		viewTerms: `Consulter ${verbatimTerms.rezicsUnitContentLicenseV1.value}`,
		grantNotice:
			"Une fois accordée, cette licence ne peut plus être révoquée et continue de couvrir les contributions ultérieures et les transferts de propriété.",
		grantedNotice:
			"Cette licence de contenu a été accordée de façon permanente pour ce contenu.",
		contributionNotice: `Le contenu que vous fournissez pendant l’application de cette licence est concédé à ${verbatimTerms.rezics.value} selon les mêmes conditions ; aucune sélection de licence distincte n’est nécessaire.`,
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
