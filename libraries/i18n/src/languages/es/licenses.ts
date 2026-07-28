import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = esTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–NoComercial–CompartirIgual 4.0 Internacional`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–CompartirIgual 4.0 Internacional`,
	},
	"all-rights-reserved": { label: "Todos los derechos reservados" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento–NoComercial 4.0 Internacional`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Reconocimiento 4.0 Internacional`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universal` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Sin especificar",
	viewTerms: `Ver las condiciones de la ${publicationLicenseTerms.inline}`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
