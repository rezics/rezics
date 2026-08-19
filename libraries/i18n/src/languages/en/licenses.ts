import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = enTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–NonCommercial–ShareAlike 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–ShareAlike 4.0 International`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} Attribution–ShareAlike 3.0 Unported`,
	},
	"all-rights-reserved": { label: "All rights reserved" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–NonCommercial 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Attribution 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universal` },
	"pdm-1.0": { label: `${verbatimTerms.cc.value} ${verbatimTerms.pdm.value} 1.0 Universal` },
	"rezics-unit-content-license-v1-1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1_1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "Unspecified",
	exclusiveSelectionHint: `Choosing All rights reserved clears other ${licenseTerms.inline} you just selected. Combinations already stored for this work are kept.`,
	residualRightsNotice:
		"All rights reserved covers only rights not expressly granted by the other licenses listed with it. It does not override or revoke those licenses.",
	viewTerms: `View ${licenseTerms.inline} terms`,
	declarationNotice: `These selections record declarations only. Their legal effect depends on whether the declarant has the necessary authority; ${verbatimTerms.rezics.value} does not verify that authority.`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `I have read and agree to the ${verbatimTerms.rezicsUnitContentLicenseV1_1.value}. I confirm that I have authority to grant it for this content, including the rights to translate it and to offer the original and translations together for payment.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
