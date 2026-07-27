import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: dockTerms } = zhHantTerminology.dock;
const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	title: dockTerms.pluralLabel,
	description: `編排並維護此內容在${dockTerms.inline}中顯示的共用內容。`,
	kinds: {
		navigation: `${dockTerms.label}類型`,
		main: {
			label: `主要${dockTerms.label}`,
			description: "顯示於主要公開介面的共用內容。",
		},
		wiki: {
			label: `知識庫${dockTerms.label}`,
			description: `顯示於此${realmTerms.inline}知識庫介面的共用內容。`,
		},
	},
	notConfigured: `尚未設定此${dockTerms.inline}；儲存後即會建立。`,
	deleted: `此${dockTerms.inline}已刪除；還原先前修訂即可再次顯示。`,
	invalidDocument: `已儲存的${dockTerms.inline}文件無效，無法進行編輯。`,
	invalidDraft: `儲存前請填妥所有必填的${verbatimTerms.id.value}欄位。`,
	unsaved: "有未儲存的變更",
	save: `儲存${dockTerms.inline}`,
	reload: "重新載入最新修訂",
	history: `${dockTerms.label}修訂歷史`,
	restore: "還原此修訂",
	remove: `刪除${dockTerms.inline}`,
	removeTitle: `要刪除此${dockTerms.inline}嗎？`,
	removeDescription: `此${dockTerms.inline}將不再公開顯示，但仍會保留修訂歷史供日後還原。`,
	cancel: "取消",
	confirmRemove: "刪除",
	revisionKinds: {
		create: "建立",
		update: "更新",
		delete: "刪除",
		restore: "還原",
	},
	blocks: {
		add: "新增內容區塊",
		remove: "移除內容區塊",
		moveUp: "上移",
		moveDown: "下移",
		type: "內容區塊類型",
		identifier: `內容 ${verbatimTerms.id.value}`,
		appearance: "呈現方式",
		searchSource: "搜尋來源",
		zoneSearch: `${zoneTerms.label}搜尋設定`,
		menuNavigation: `導覽 ${verbatimTerms.id.value}`,
		results: "結果版面",
		showResultCount: "顯示結果數量",
		orientation: "排列方向",
		style: "樣式",
		sources: {
			global: "全域模板",
			book: "書籍模板",
			media: "媒體模板",
			software: "軟體模板",
			realm: `${realmTerms.label}模板`,
			zone: `${zoneTerms.label}模板`,
		},
		appearances: {
			inline: "行內",
			card: "卡片",
			cover: "封面",
			links: "連結",
			buttons: "按鈕",
			tabs: "頁籤",
			drawer: "抽屜",
		},
		orientations: { horizontal: "水平", vertical: "垂直" },
		resultsLayouts: { list: "清單", grid: "格狀", compact: "精簡" },
		styles: { line: "線條", space: "留白", section: "章節" },
		types: {
			"post-full-view": `完整${postTerms.inline}`,
			"unit-ref": "內容引用",
			search: "搜尋",
			feed: "內容動態",
			menu: "導覽選單",
			divider: "分隔",
			media: "媒體",
			"unit-list": "內容清單",
			"portable-text": "文字內容",
			columns: "欄",
			group: "群組",
			callout: "提示框",
			tabs: "頁籤",
		},
	},
};
