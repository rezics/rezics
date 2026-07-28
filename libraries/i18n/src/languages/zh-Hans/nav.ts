import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: followTerms } = zhHansTerminology.follow;
const { forms: labelTerms } = zhHansTerminology.label;
const { forms: postTerms } = zhHansTerminology.post;
const { forms: realmTerms } = zhHansTerminology.realm;
const { forms: tagStructureTerms } = zhHansTerminology.tagStructure;
const { forms: unitSlugTerms } = zhHansTerminology.unitSlug;
const { forms: zoneTerms } = zhHansTerminology.zone;

export default {
	home: "主页",
	studio: verbatimTerms.studio.value,
	units: "作品",
	entity: "目录",
	realm: realmTerms.label,
	collections: "收藏集",
	favorites: "收藏",
	progress: "进度",
	me: "我的",
	skipToContent: "跳到主要内容",
	navigation: "导航",
	content: "内容",
	userMenu: {
		label: "用户菜单",
		description: "查看个人资料、调整偏好与设置，或注销账户。",
		back: "返回用户菜单",
		close: "关闭用户菜单",
		viewProfile: "查看个人资料",
		myContent: "我的内容",
		settings: "设置",
		console: "管理主控台",
		invitations: "收到的访问邀请",
		signOut: "注销",
	},
	sidebar: {
		title: "主要导航",
		description: `前往主页、常用功能，以及你${followTerms.action}的${zoneTerms.plural}与${realmTerms.plural}。`,
		open: "打开主要导航",
		close: "关闭主要导航",
		expand: "展开侧边栏",
		collapse: "收起侧边栏",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `全部${zoneTerms.plural}`,
		allRealms: `全部${realmTerms.plural}`,
		zonesEmpty: `你${followTerms.action}的${zoneTerms.plural}会显示在这里。`,
		realmsEmpty: `你${followTerms.action}的${realmTerms.plural}会显示在这里。`,
		loading: "正在加载侧边栏内容。",
		error: "无法加载侧边栏内容。",
	},
	following: {
		title: followTerms.collectionLabel,
		all: `全部${followTerms.collectionLabel}`,
		empty: `你${followTerms.action}的内容条目会显示在这里。`,
		description: `筛选、置顶并整理你${followTerms.action}的内容条目。`,
		filter: `筛选${followTerms.collectionLabel}类型`,
		favorite: "置顶",
		unfavorite: "取消置顶",
		types: {
			slug_namespace: `${unitSlugTerms.label}命名空间`,
			profile: "用户",
			book: "书籍",
			software: "软件",
			media: "媒体",
			release: "发行",
			entity: "实体",
			label: labelTerms.label,
			tag: "标签",
			structure: tagStructureTerms.label,
			series: "系列",
			zone: zoneTerms.label,
			zone_page: `${zoneTerms.label}页面`,
			collection: "收藏集",
			post: postTerms.label,
			poll: "投票",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label}规则`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
