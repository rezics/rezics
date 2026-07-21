import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: followTerms } = zhHantTerminology.follow;
const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: unitSlugTerms } = zhHantTerminology.unitSlug;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	explore: "發現",
	units: "作品",
	entity: "目錄",
	realm: realmTerms.label,
	collections: "收藏集",
	favorites: "收藏",
	progress: "進度",
	me: "我的",
	skipToContent: "跳到主要內容",
	navigation: "導覽",
	content: "內容",
	sidebar: {
		title: "主要導覽",
		description: `前往探索頁，以及你${followTerms.action}的${zoneTerms.plural}與${realmTerms.plural}。`,
		open: "開啟主要導覽",
		close: "關閉主要導覽",
		expand: "展開側邊欄",
		collapse: "收合側邊欄",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		zonesEmpty: `你${followTerms.action}的${zoneTerms.plural}會顯示在這裡。`,
		realmsEmpty: `你${followTerms.action}的${realmTerms.plural}會顯示在這裡。`,
		loading: "正在載入側邊欄內容。",
		error: "無法載入側邊欄內容。",
	},
	following: {
		title: followTerms.collectionLabel,
		manage: `管理${followTerms.action}`,
		all: "所有類型",
		empty: `你${followTerms.action}的內容單元會顯示在這裡。`,
		description: `篩選、置頂並整理你${followTerms.action}的內容單元。`,
		filter: `篩選${followTerms.collectionLabel}類型`,
		favorite: "置頂",
		unfavorite: "取消置頂",
		types: {
			slug_namespace: `${unitSlugTerms.label}命名空間`,
			profile: "使用者",
			book: "書籍",
			software: "軟體",
			media: "媒體",
			release: "發行",
			entity: "實體",
			tag: "標籤",
			series: "系列",
			zone: zoneTerms.label,
			collection: "收藏集",
			post: postTerms.label,
			poll: "投票",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label}規則`,
		},
	},
};
