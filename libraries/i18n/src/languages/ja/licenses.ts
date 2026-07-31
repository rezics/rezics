import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = jaTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利–継承 4.0 国際`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–継承 4.0 国際`,
	},
	"all-rights-reserved": { label: "無断複写・転載を禁ず" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利 4.0 国際`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 表示 4.0 国際`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 ユニバーサル` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	viewTerms: `${publicationLicenseTerms.inline} 利用規約を見る`,
	options,
	unitContent: {
		none: "なし",
		viewTerms: `${verbatimTerms.rezicsUnitContentLicenseV1.value} を見る`,
		grantNotice:
			"一度付与すると撤回できず、このコンテンツへの今後の貢献と所有権の移転にも引き続き適用されます。",
		noneNotice:
			"コンテンツライセンスは付与されません。この作品を索引項目としてのみ使用し、作品のコンテンツを公開またはホストしない場合に限り「なし」を選択してください。",
		noneConfirmationTitle: `${verbatimTerms.rezics.value} へのコンテンツライセンスなしで作成しますか？`,
		noneConfirmationNotice: `${verbatimTerms.rezics.value} で作品のコンテンツを公開またはホストする場合は、コンテンツライセンスを維持してください。この項目が作品の索引のみを目的とする場合、ライセンスは不要です。ライセンスなしで作品本文やその他の著作権保護対象コンテンツをこの項目に公開しないでください。`,
		keepLicense: "ライセンスを維持",
		confirmNone: "ライセンスなしに変更",
		publicWorkNotice: `公共作品は ${verbatimTerms.rezics.value} にコンテンツライセンスを付与せず、作品の索引情報のみを収録するために使用します。`,
		grantedNotice: "このコンテンツには、このコンテンツライセンスが恒久的に適用されています。",
		contributionNotice: `このライセンスの適用中に提供するコンテンツは、同じ条件で ${verbatimTerms.rezics.value} にライセンスされます。個別にライセンスを選択する必要はありません。`,
		cancelGrant: "キャンセル",
		confirmGrant: "ライセンスを付与",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
