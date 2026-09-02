import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: entityTerms } = zhHantTerminology.entity;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "集中查看您目前可編輯的內容，或曾參與的公開內容。",
		backToApplication: `返回 ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} 導覽`,
		overview: "內容類型",
		backToOverview: "返回內容類型",
	},
	mode: {
		label: "內容清單",
		options: {
			workspace: "你的工作空間",
			contributions: "你的貢獻",
		},
	},
	entityHelp: {
		label: "開啟署名說明",
		title: "署名說明",
		description: `署名需要關聯${entityTerms.inline}。如果搜尋不到${entityTerms.inline}，或想建立例如代表自己的作者身分，請先建立${entityTerms.inline}。`,
		createEntity: `建立${entityTerms.inline}`,
		close: "關閉",
	},
	sections: {
		book: { label: "書籍", description: "查看及管理與您相關的書籍。" },
		software: { label: "軟體", description: "查看及管理與您相關的軟體條目。" },
		media: { label: "媒體", description: "查看及管理與您相關的媒體內容。" },
		entity: {
			label: entityTerms.pluralLabel,
			description: `查看及管理與您相關的${entityTerms.plural}。`,
		},
		tag: { label: "標籤", description: "查看及管理與您相關的標籤。" },
		realm: {
			label: realmTerms.label,
			description: `查看及管理與您相關的${realmTerms.label}。`,
		},
		zone: { label: zoneTerms.label, description: `查看及管理與您相關的${zoneTerms.label}。` },
		post: { label: postTerms.label, description: `查看及管理與您相關的${postTerms.label}。` },
		wiki: { label: "百科文章", description: "查看及管理您參與維護的百科文章。" },
		collection: { label: "收藏集", description: "查看及管理與您相關的收藏集。" },
		review: { label: "評論", description: "查看及管理與您相關的評論。" },
		poll: { label: "投票", description: "查看及管理與您相關的投票。" },
	},
	realmTagContext: {
		label: `${realmTerms.label}標籤解釋`,
		description: `建立此${realmTerms.label}對某個標籤的百科說明。`,
	},
	communityUnitSearch: {
		policyTitle: "建立前請先搜尋",
		policy:
			"為了維持良好的社群環境，建立公共條目前，請先搜尋並確認您想建立的內容尚不存在。若您濫用建立公共條目的權限，可能會受到處分。",
		confirmationLabel: insert("我已檢查現有{{subject}}，並確認這個條目尚不存在。", {
			subject: String,
		}),
		prompt: insert("搜尋現有{{subject}}", { subject: String }),
		pageTitle: insert("搜尋現有{{subject}}", { subject: String }),
		pageDescription: insert("先確認您想建立的{{subject}}是否已存在。", {
			subject: String,
		}),
		backToSection: insert("返回{{subject}}", { subject: String }),
		searchLabel: insert("搜尋{{subject}}", { subject: String }),
		searchPlaceholder: insert("輸入{{subject}}的名稱", { subject: String }),
		searchAction: "搜尋",
		searchHint: "輸入名稱以搜尋可能已存在的條目。",
		searchFailed: "搜尋暫時無法使用。請重試，或返回建立表單。",
		resultsTitle: "可能已存在的條目",
		noResultsTitle: insert("找不到相符的{{subject}}", { subject: String }),
		noResultsDescription: "確認搜尋詞正確後，您可以繼續前往建立。",
		realmTagContextOnly: `這裡只會顯示此${realmTerms.label}已正式說明的標籤。若缺少標籤，請先由${realmTerms.label}管理者建立標籤解釋。`,
		notListedTitle: "這些結果都不是您要找的內容？",
		notListedDescription: "請先檢查相似條目；若都不相符，再繼續建立新條目。",
		createAction: "繼續建立",
		subjects: {
			book: "書籍",
			software: "軟體",
			media: "媒體",
			person: "人物",
			organization: "組織",
			character: "角色",
			tag: "標籤",
		},
	},
	list: {
		create: "建立",
		empty: {
			workspace: "沒有符合目前篩選條件的可編輯內容。",
			contributions: "沒有符合目前篩選條件的公開貢獻。",
		},
		untitled: "未命名內容",
		immutable: "不可變",
		contributionCount: insert("貢獻 {{count}} 次", { count: Number }),
		activity: {
			visited: "最近瀏覽",
			assigned: "獲指派",
			created: "建立",
			participated: "參與編輯",
		},
	},
	filters: {
		sourceLabel: "工作空間來源",
		kindLabel: "貢獻類型",
		statusLabel: "內容狀態",
		visibilityLabel: "可見性",
		any: "不限",
		more: "更多篩選",
		clear: "清除篩選",
		cancel: "取消",
		apply: "套用篩選",
		sources: {
			all: "全部可編輯內容",
			owned: "我擁有的",
			direct: "直接指派",
			delegated: "團隊委派",
		},
		kinds: {
			all: "全部貢獻",
			created: "我建立的",
			contributed: "我參與編輯的",
		},
		statuses: { draft: "草稿", published: "已發布", archived: "已封存" },
		visibilities: { public: "公開", unlisted: "不列出", private: "私人" },
	},
	relations: {
		owner: "擁有者",
		direct: "直接指派",
		realm: "團隊委派",
		created: "建立者",
		contributed: "貢獻者",
	},
	developmentBadge: "開發中",
};
