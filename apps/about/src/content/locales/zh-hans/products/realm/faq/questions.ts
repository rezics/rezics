import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const content = {
	preview: `${zhHansTerminology.realm.forms.inline}的画面是真实产品截图吗？`,
	status: "页面上的实现状态如何判定？",
} satisfies typeof import("../../../../en/products/realm/faq/questions").default;

export default content;
