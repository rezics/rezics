import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	paragraph: "內文",
	heading2: "二級標題",
	heading3: "三級標題",
	quote: "引用",
	bold: "粗體",
	italic: "斜體",
	bulletList: "項目符號清單",
	numberedList: "編號清單",
	link: "連結",
	linkPrompt: `支援 ${verbatimTerms.http.value}、${verbatimTerms.https.value}、${verbatimTerms.mailto.value} 或站內相對網址。`,
	linkUrl: "連結網址",
	openInNewTab: "在新分頁開啟",
	addLink: "新增連結",
	removeLink: "移除連結",
	invalidLink: "請輸入支援的連結網址。",
	undo: "撤銷",
	redo: "重做",
	style: "文字樣式",
	preview: "預覽",
	placeholder: "開始撰寫，或輸入 / 插入內容區塊。",
	slashMenu: "插入",
	slashHint: `輸入 / 插入區塊；輸入 ${verbatimTerms.profileSlugPrefix.value}、t/、e/、r/、z/ 插入項目提及。`,
	mentionSearchPrompt: "請輸入文字以搜尋。",
	mentionUsers: "使用者",
	mentionTags: "標籤",
	mentionEntities: "實體",
	mentionRealms: realmTerms.label,
	mentionZones: zoneTerms.label,
	unavailableMention: "無法顯示的項目",
	richText: "多格式文字",
	toolbar: "文字格式工具列",
};
