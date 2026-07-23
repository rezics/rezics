import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: followTerms } = zhHantTerminology.follow;
const { forms: labelTerms } = zhHantTerminology.label;
const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: unitSlugTerms } = zhHantTerminology.unitSlug;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	home: "主頁",
	studio: verbatimTerms.studio.value,
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
	userMenu: {
		label: "使用者選單",
		description: "查看個人資料、調整偏好與設定，或登出帳戶。",
		back: "返回使用者選單",
		close: "關閉使用者選單",
		viewProfile: "查看個人資料",
		myContent: "我的內容",
		settings: "設定",
		invitations: "收到的存取邀請",
		signOut: "登出",
	},
	sidebar: {
		title: "主要導覽",
		description: `前往主頁、常用功能，以及你${followTerms.action}的${zoneTerms.plural}與${realmTerms.plural}。`,
		open: "開啟主要導覽",
		close: "關閉主要導覽",
		expand: "展開側邊欄",
		collapse: "收合側邊欄",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `全部${zoneTerms.plural}`,
		allRealms: `全部${realmTerms.plural}`,
		zonesEmpty: `你${followTerms.action}的${zoneTerms.plural}會顯示在這裡。`,
		realmsEmpty: `你${followTerms.action}的${realmTerms.plural}會顯示在這裡。`,
		loading: "正在載入側邊欄內容。",
		error: "無法載入側邊欄內容。",
	},
	following: {
		title: followTerms.collectionLabel,
		all: `全部${followTerms.collectionLabel}`,
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
			label: labelTerms.label,
			tag: "標籤",
			series: "系列",
			zone: zoneTerms.label,
			zone_page: `${zoneTerms.label}頁面`,
			collection: "收藏集",
			post: postTerms.label,
			poll: "投票",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label}規則`,
		},
	},
};
