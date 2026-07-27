import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	title: "管理主控台",
	description: "依平台權限開放管理功能；這裡不代表任何使用者身分或工作關係。",
	backToApplication: "返回應用程式",
	navigation: "管理主控台導覽",
	overview: "所有管理功能",
	cancel: "取消",
	sections: {
		access: {
			label: "平台存取權",
			description: "檢視或管理使用者獲得的平台級權限，以及每筆授權的期限與來源。",
		},
		audit: {
			label: "安全稽核",
			description: `檢視平台、${realmTerms.label}與條目的高影響管理事件及安全決策。`,
		},
	},
	access: {
		searchTitle: "尋找使用者",
		searchLabel: "名稱或登入電子郵件",
		searchPlaceholder: "輸入名稱或電子郵件",
		search: "搜尋",
		searchResults: "搜尋結果",
		activeProfiles: "目前擁有平台權限的使用者",
		noProfiles: "目前沒有有效的平台權限授權。",
		noSearchResults: "找不到符合條件的使用者。",
		selectProfile: "請選擇一位使用者，以檢視其平台權限。",
		capabilityCount: insert("{{count}} 項權限", { count: Number }),
		capability: "權限",
		expiry: "有效期限",
		expiryFor: insert("「{{capability}}」的有效期限", { capability: String }),
		noExpiry: "無期限",
		provenance: "授權來源",
		grantProvenance: insert("由 {{profileId}} 於 {{date}} 授予", {
			profileId: String,
			date: String,
		}),
		notGranted: "未直接授予",
		readOnly: "你可以檢視平台權限，但沒有變更權限。",
		grantAll: "授予全部權限",
		clearAll: "清除全部權限",
		save: "儲存平台權限",
		revokeAllTitle: "撤銷這位使用者的全部平台權限？",
		revokeAllDescription:
			"這項變更會撤銷每一筆有效授權。若因此移除最後一位無期限的平台存取權管理者，伺服器會拒絕變更。",
		confirmRevokeAll: "確認全部撤銷",
	},
	audit: {
		category: "事件類別",
		allCategories: "所有類別",
		categories: {
			admin_activity: "管理活動",
			policy_denied: "政策拒絕",
			system_event: "系統事件",
		},
		outcome: "結果",
		allOutcomes: "所有結果",
		outcomes: {
			succeeded: "成功",
			denied: "已拒絕",
			failed: "失敗",
		},
		time: "時間",
		action: "動作",
		actor: "執行者",
		authority: "權限範圍",
		authorities: {
			platform: "平台",
			realm: realmTerms.label,
			unit: "條目",
		},
		empty: "沒有符合目前篩選條件的稽核事件。",
		previousPage: "上一頁",
		nextPage: "下一頁",
		selectEvent: "請選擇一筆事件，以檢視完整稽核內容。",
		detailsTitle: "事件內容",
		systemActor: "系統",
		credential: "憑證類型",
		credentialId: `憑證 ${verbatimTerms.id.value}`,
		credentials: {
			session: "互動式工作階段",
			api_token: `${verbatimTerms.api.value} 權杖`,
			bootstrap: "系統初始化",
			system: "系統程序",
		},
		scopedAuthority: insert("{{kind}}（{{id}}）", { kind: String, id: String }),
		target: "目標",
		noTarget: "沒有特定目標",
		reasonCode: "原因代碼",
		requestId: `請求 ${verbatimTerms.id.value}`,
		traceId: `分散式追查 ${verbatimTerms.id.value}`,
		rawDetails: "結構化內容",
	},
};
