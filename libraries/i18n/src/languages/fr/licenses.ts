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
		confirmationLabel: `J’ai lu et j’accepte la ${verbatimTerms.rezicsUnitContentLicenseV1.value}. Je confirme également être habilité à accorder cette licence pour ce contenu.`,
		noneNotice:
			"Aucune licence de contenu ne sera accordée. Choisissez « Aucune » uniquement si cette œuvre sert d’entrée d’index et si son contenu ne sera ni publié ni hébergé.",
		noneConfirmationTitle: `Créer sans licence de contenu pour ${verbatimTerms.rezics.value} ?`,
		noneConfirmationNotice: `Si vous souhaitez publier ou héberger le contenu de cette œuvre sur ${verbatimTerms.rezics.value}, conservez la licence de contenu. Si l’entrée sert uniquement à indexer l’œuvre, aucune licence de contenu n’est nécessaire. Sans cette licence, ne publiez pas le texte de l’œuvre ni d’autre contenu protégé par le droit d’auteur dans cette entrée.`,
		keepLicense: "Conserver la licence",
		confirmNone: "Continuer sans licence",
		publicWorkNotice: `Les œuvres communautaires n’accordent aucune licence de contenu à ${verbatimTerms.rezics.value} et ne doivent contenir que des informations d’index sur l’œuvre.`,
		grantedNotice:
			"Cette licence de contenu a été accordée de façon permanente pour ce contenu.",
		contributionNotice: `Le contenu que vous fournissez pendant l’application de cette licence est concédé à ${verbatimTerms.rezics.value} selon les mêmes conditions ; aucune sélection de licence distincte n’est nécessaire.`,
		cancelGrant: "Annuler",
		confirmGrant: "Accorder la licence",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
