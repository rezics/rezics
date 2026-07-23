import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: followTerms } = zhHantTerminology.follow;

export default {
	page: {
		title: "標籤",
		description: `檢視一般標籤，以及你所選標籤來源對這個作品的${realmTerms.label}情境判斷。`,
		viewAll: "查看完整標籤頁",
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
};
