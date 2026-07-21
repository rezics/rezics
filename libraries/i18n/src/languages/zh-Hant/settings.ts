import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: unitSlugTerms } = zhHantTerminology.unitSlug;

export default {
	profile: "個人資料",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `使用 1 至 63 個小寫 ${verbatimTerms.ascii.value} 字母、數字或連字號。變更後，舊網址會永久轉址至新網址。`,
	preferences: "偏好設定",
	interfaceLanguage: "介面語言",
	contentLanguage: "內容語言偏好",
	account: "帳戶",
	accountDescription: "管理目前的登入階段。",
	defaultLicense: `預設 ${verbatimTerms.license.value}`,
	general: "一般",
	realmManageMode: `預設以${realmTerms.inline}管理模式建立`,
	on: "開啟",
	off: "關閉",
};
