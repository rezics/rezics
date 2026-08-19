import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = frTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Pas d’Utilisation Commerciale–Partage dans les Mêmes Conditions 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Partage dans les Mêmes Conditions 4.0 International`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} Attribution–Partage dans les Mêmes Conditions 3.0 non transposé`,
	},
	"all-rights-reserved": { label: "Tous droits réservés" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–Pas d’Utilisation Commerciale 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Attribution 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universel` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Non précisée",
	exclusiveSelectionHint: `Choisir Tous droits réservés retire les autres ${licenseTerms.inline} que vous venez de sélectionner. Les combinaisons déjà enregistrées pour cette œuvre sont conservées.`,
	residualRightsNotice:
		"Tous droits réservés ne couvre que les droits que les autres licences listées n’accordent pas expressément. Il ne les remplace pas et ne les révoque pas.",
	viewTerms: `Voir les conditions de la ${licenseTerms.inline}`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `J’ai lu et j’accepte la ${verbatimTerms.rezicsUnitContentLicenseV1.value}. Je confirme également être habilité à accorder cette ${frTerminology.license.forms.inline} pour ce contenu.`,
		profileOwnedOnlyNotice: `Les œuvres communautaires n’accordent aucune ${frTerminology.license.forms.inline} de contenu à ${verbatimTerms.rezics.value} et ne doivent contenir que des informations d’index sur l’œuvre.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
