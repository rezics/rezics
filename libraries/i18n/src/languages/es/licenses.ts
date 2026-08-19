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
	"pdm-1.0": { label: `${verbatimTerms.cc.value} ${verbatimTerms.pdm.value} 1.0 Universal` },
	"rezics-unit-content-license-v1-1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1_1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Sin especificar",
	exclusiveSelectionHint: `Elegir Reservados todos los derechos quita las otras ${licenseTerms.inline} que acabas de marcar. Las combinaciones ya guardadas para esta obra se conservan.`,
	residualRightsNotice:
		"Reservados todos los derechos cubre solo los derechos que las demás licencias listadas no conceden de forma expresa. No las anula ni las revoca.",
	viewTerms: `Ver las condiciones de la ${licenseTerms.inline}`,
	declarationNotice: `Estas opciones solo registran declaraciones. Su efecto jurídico depende de que la persona declarante tenga la autoridad necesaria; ${verbatimTerms.rezics.value} no verifica esa autoridad.`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `He leído y acepto la ${verbatimTerms.rezicsUnitContentLicenseV1_1.value}. Confirmo que tengo autoridad para concederla para este contenido, incluidos los derechos de traducción y de ofrecer conjuntamente mediante pago el original y sus traducciones.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
