import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = esTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–NoComercial–CompartirIgual 4.0 Internacional`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–CompartirIgual 4.0 Internacional`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–CompartirIgual 3.0 no portada`,
	},
	"all-rights-reserved": { label: "Todos los derechos reservados" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–NoComercial 4.0 Internacional`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento 4.0 Internacional`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universal` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Sin especificar",
	exclusiveSelectionHint: `Elegir Reservados todos los derechos quita las otras ${licenseTerms.inline} que acabas de marcar. Las combinaciones ya guardadas para esta obra se conservan.`,
	residualRightsNotice:
		"Reservados todos los derechos cubre solo los derechos que las demás licencias listadas no conceden de forma expresa. No las anula ni las revoca.",
	viewTerms: `Ver las condiciones de la ${licenseTerms.inline}`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `He leído y acepto la ${verbatimTerms.rezicsUnitContentLicenseV1.value} y confirmo que tengo autoridad para conceder esta ${esTerminology.license.forms.inline} para este contenido.`,
		profileOwnedOnlyNotice: `Las obras comunitarias no conceden una ${esTerminology.license.forms.inline} de contenido a ${verbatimTerms.rezics.value} y solo deben incluir información de índice sobre la obra.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
