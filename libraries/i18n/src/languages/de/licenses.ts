import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = deTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Nicht kommerziell–Weitergabe unter gleichen Bedingungen 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Weitergabe unter gleichen Bedingungen 4.0 International`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Weitergabe unter gleichen Bedingungen 3.0 Unportiert`,
	},
	"all-rights-reserved": { label: "Alle Rechte vorbehalten" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung–Nicht kommerziell 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Namensnennung 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universell` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Nicht angegeben",
	exclusiveSelectionHint:
		"Wenn du Alle Rechte vorbehalten neu auswählst, werden andere gerade neu gewählte Veröffentlichungslizenzen zunächst entfernt. Bereits gespeicherte Kombinationen bleiben erhalten.",
	residualRightsNotice:
		"Alle Rechte vorbehalten erfasst nur Rechte, die die anderen aufgeführten Lizenzen nicht ausdrücklich einräumen. Es überschreibt oder widerruft diese Lizenzen nicht.",
	viewTerms: `Bedingungen der ${licenseTerms.inline} anzeigen`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `Ich habe die ${verbatimTerms.rezicsUnitContentLicenseV1.value} gelesen und stimme ihr zu. Ich bestätige außerdem, dass ich berechtigt bin, diese ${deTerminology.license.forms.label} für diesen Inhalt zu erteilen.`,
		profileOwnedOnlyNotice: `Gemeinschaftswerke erteilen ${verbatimTerms.rezics.value} keine Inhaltslizenz und sollten nur Verzeichnisangaben zum Werk enthalten.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
