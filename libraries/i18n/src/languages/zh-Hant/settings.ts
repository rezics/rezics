import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: unitSlugTerms } = zhHantTerminology.unitSlug;
const { forms: publicationLicenseTerms } = zhHantTerminology.publicationLicense;

export default {
	workspace: {
		title: "設定",
		description: "管理個人資料、使用偏好、帳戶安全與邀請。",
		backToApplication: "返回應用程式",
		backToOverview: "返回設定",
		navigation: "設定導覽",
		overview: "所有設定",
		sections: {
			profile: {
				label: "個人資料",
				description: "更新公開名稱、簡介、頭像、橫幅與個人網址。",
			},
			preferences: {
				label: "偏好設定",
				description: "選擇介面語言、內容語言、內容分級與預設授權。",
			},
			account: {
				label: "帳戶",
				description: "查看帳戶資訊及管理目前的登入狀態。",
			},
			security: {
				label: "安全性",
				description: "變更密碼並管理已登入的裝置。",
			},
			invitations: {
				label: "邀請",
				description: "檢視並回應收到的條目存取邀請。",
			},
		},
	},
	profile: "個人資料",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `使用 1 至 63 個小寫 ${verbatimTerms.ascii.value} 字母、數字或連字號。變更後，舊網址會永久轉址至新網址。`,
	preferences: "偏好設定",
	interfaceLanguage: "介面語言",
	contentLanguage: "內容語言偏好",
	account: "帳戶",
	accountDescription: "管理目前的登入階段。",
	security: "安全性",
	securityDescription: "變更帳戶密碼。您也可以同時登出其他裝置。",
	currentPassword: "目前密碼",
	newPassword: "新密碼",
	revokeOtherSessions: "變更密碼後登出其他裝置",
	passwordChanged: "密碼已變更。",
	sessions: "已登入的裝置",
	sessionsDescription: "撤銷不再使用或不認得的登入階段。",
	currentSession: "目前裝置",
	unknownDevice: "未知裝置",
	unknownAddress: "未知位址",
	lastUpdated: "最近活動",
	sessionExpires: "到期時間",
	revokeSession: "登出此裝置",
	defaultLicense: `預設${publicationLicenseTerms.label}`,
	general: "一般",
	realmManageMode: `預設以${realmTerms.inline}管理模式建立`,
	on: "開啟",
	off: "關閉",
};
