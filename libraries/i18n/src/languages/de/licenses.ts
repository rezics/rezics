import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = deTerminology.publicationLicense;
const { forms: postTerms } = deTerminology.post;

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

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "Nicht angegeben",
	viewTerms: `Bedingungen der ${publicationLicenseTerms.inline} anzeigen`,
	options,
	unitContent: {
		none: "Keine",
		viewTerms: `Bedingungen für ${verbatimTerms.rezicsUnitContentLicenseV1.value} anzeigen`,
		grantNotice: `Nach der Erteilung kann diese Lizenz nicht widerrufen werden und gilt weiterhin für künftige ${postTerms.pluralLabel} zu diesem Inhalt sowie bei Eigentumsübertragungen.`,
		grantedNotice: "Für diesen Inhalt wurde diese Inhaltslizenz dauerhaft erteilt.",
		contributionNotice: `Inhalte, die Sie während der Geltung dieser Lizenz beisteuern, werden ${verbatimTerms.rezics.value} zu denselben Bedingungen lizenziert; eine gesonderte Lizenzauswahl ist nicht erforderlich.`,
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
