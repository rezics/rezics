import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: realmTerms } = jaTerminology.realm;

export default {
	eyebrow: "共にキュレーションし、注意深く議論",
	title: "ユニット、関係、知識が共に成長する場所",
	description: `書籍、ソフトウェア、メディアを探索し、進捗を記録、${realmTerms.inline}でエントリーを改善`,
	latest: "最近追加",
} satisfies typeof import("../zh-Hant/home").default;
