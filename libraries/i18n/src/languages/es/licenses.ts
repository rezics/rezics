import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
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

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "Sin especificar",
	viewTerms: `Ver las condiciones de la ${publicationLicenseTerms.inline}`,
	options,
	unitContent: {
		none: "Ninguna",
		viewTerms: `Consultar ${verbatimTerms.rezicsUnitContentLicenseV1.value}`,
		grantNotice:
			"Una vez concedida, esta licencia no se puede revocar y continúa aplicándose a las contribuciones posteriores y a las transferencias de propiedad.",
		grantedNotice:
			"Esta licencia de contenido se ha concedido de forma permanente para este contenido.",
		contributionNotice: `El contenido que aportes mientras se aplique esta licencia se concede a ${verbatimTerms.rezics.value} bajo las mismas condiciones; no es necesario elegir otra licencia.`,
		cancelGrant: "Cancelar",
		confirmGrant: "Conceder licencia",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
