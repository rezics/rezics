import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const content = {
	preview: `${zhHantTerminology.realm.forms.inline}的畫面是真實產品截圖嗎？`,
	status: "頁面上的實作狀態如何判定？",
} satisfies typeof import("../../../../en/products/realm/faq/questions").default;

export default content;
