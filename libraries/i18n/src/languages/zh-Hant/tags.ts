import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: followTerms } = zhHantTerminology.follow;
const { forms: tagStructureTerms } = zhHantTerminology.tagStructure;

export default {
	page: {
		title: "標籤",
		description: `檢視一般標籤，以及你所選標籤來源對這個作品的${realmTerms.label}情境判斷。`,
		viewAll: "查看完整標籤頁",
		manageOnTagPage: `請在專用標籤頁加入標籤或${tagStructureTerms.label}，以保留清楚的投票情境。`,
	},
	card: {
		open: insert("開啟「{{tag}}」標籤卡片（{{context}}）", {
			tag: String,
			context: String,
		}),
		close: "關閉標籤卡片",
		globalContext: "一般標籤",
		structureContext: tagStructureTerms.label,
		policy: `${realmTerms.label}設定`,
		search: "搜尋此標籤",
		details: "查看標籤詳情",
	},
	selection: {
		start: "多選",
		finish: "結束多選",
		add: "加入選取",
		remove: "移出選取",
		addNamed: insert("選取「{{tag}}」", { tag: String }),
		removeNamed: insert("取消選取「{{tag}}」", { tag: String }),
		selectedCount: insert("已選 {{count}} 個標籤", { count: Number }),
		search: "搜尋所選標籤",
		clear: "清除選取",
	},
	basic: {
		title: "基本標籤",
		description: `由一般標籤與${tagStructureTerms.pluralLabel}組成，不帶入任何${realmTerms.label}的情境判斷。`,
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `${tagStructureTerms.pluralLabel}會保留有意義的階層，並優先於扁平標籤顯示。`,
		addTitle: `加入${tagStructureTerms.inline}`,
		addDescription: `請先搜尋已通過的${tagStructureTerms.plural}；加入時會支持整條路徑及路徑上的每個標籤。`,
		add: `加入${tagStructureTerms.label}`,
		create: `建立${tagStructureTerms.label}`,
		details: `查看${tagStructureTerms.label}`,
		empty: `這個作品還沒有通過的${tagStructureTerms.plural}。`,
		memberFallback: "未命名標籤",
		pathLabel: `依序排列的${tagStructureTerms.label}`,
	},
	detail: {
		childrenTitle: "直接子標籤",
		childrenDescription: `這些關係來自通過投票且由社群鎖定的${tagStructureTerms.label}；每個子標籤下方會顯示其直接子標籤。`,
		noChildren: "這個標籤目前沒有通過的直接子標籤。",
		grandchildrenTitle: "直接子標籤",
	},
	createStructure: {
		title: `建立${tagStructureTerms.label}`,
		description:
			"請依「較廣泛」到「較具體」的順序建立路徑。建立後社群成員不能編輯；平台管理員可進行留有稽核紀錄的修正。",
		pick: "選擇下一個標籤",
		addMember: "加入路徑",
		removeMember: "從路徑移除",
		moveEarlier: "向前移",
		moveLater: "向後移",
		preview: "社群鎖定路徑預覽",
		minimum: "請加入至少兩個不同的標籤。",
		submit: `建立${tagStructureTerms.label}並投票`,
	},
	adminEditStructure: {
		title: `修正${tagStructureTerms.label}`,
		description:
			"平台管理員可以修正成員或順序；條目身分、既有投票與所有套用關係都會保留，修正內容也會寫入歷史紀錄。",
		reasonLabel: "修正理由",
		reasonPlaceholder: "說明為何需要進行這項管理修正。",
		submit: "儲存並記錄修正",
	},
	global: {
		title: "一般標籤",
		description: "一般標籤由所有具備互動權限的使用者共同提出及判斷。",
		addTitle: "加入一般標籤",
		addDescription: "先搜尋既有標籤；加入時會同時投下一票「符合」。",
		add: "加入標籤",
		pinned: "精選",
		empty: "這個作品還沒有一般標籤。",
	},
	realms: {
		title: `${realmTerms.label}標籤情境`,
		description: `各${realmTerms.inline}的判斷彼此獨立，不會與一般標籤或其他${realmTerms.inline}合併計分。`,
		policy: `${realmTerms.label}設定的標籤`,
		votes: `${realmTerms.label}成員投票`,
		context: "查看投票情境",
		empty: "你選擇的標籤來源目前沒有對這個作品提出判斷。",
		cannotVote: `加入這個${realmTerms.inline}後才能參與該情境的投票。`,
	},
	vote: {
		fits: "符合",
		doesNotFit: "不符合",
		clear: "移除我的判斷",
		signIn: "登入後投票",
		signInDescription: "登入後即可在一般標籤情境中投票。",
		summary: insert("淨票數 {{score}} · {{count}} 票", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "標籤來源",
		description: `選擇並排序要在作品標籤區域顯示的${realmTerms.label}來源；這項設定不會${followTerms.action}作品，也不會改變${realmTerms.inline}成員身分。`,
		addTitle: "加入標籤來源",
		addDescription: `搜尋可閱讀的${realmTerms.label}，並加入個人標籤來源清單。`,
		add: "加入來源",
		remove: "移除來源",
		moveEarlier: "向前移",
		moveLater: "向後移",
		empty: "尚未選擇任何標籤來源。",
		manage: "管理標籤來源",
	},
	unnamedTag: "未命名標籤",
	unnamedRealm: `未命名${realmTerms.label}`,
	unnamedStructure: `未命名${tagStructureTerms.label}`,
};
