import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "閱讀介面",
	journey: "本次旅程",
	entrance: "入口",
	passageTitle: "段落：檔案入口",
	branchDescription: "讀者抵達一個已有記錄的分支。選擇的路徑會記錄為旅程步驟，並與一般進度分開。",
	choose: "做出選擇",
	choiceA: "選擇 A · 繼續前往閱覽室",
	choiceAOutcome: "段落：閱覽室",
	choiceAStep: "選擇 A → 閱覽室",
	choiceB: "選擇 B · 離開檔案館",
	choiceBOutcome: "結局：稍後再來",
	choiceBStep: "選擇 B → 結局",
	authoring: "作者編輯器",
	validation: `結構有效 · ${verbatimTerms.dag.value} 檢查通過`,
	authoringSequence: `${verbatimTerms.gameContentStructure.value} 創作序列`,
	passage: "段落",
	ending: "結局",
	entry: "入口",
	choicesTwo: "選擇：2",
	retirable: "可退役",
	constraints: "入口 → 段落 → 結局 · 不含循環、腳本、變數、戰鬥或執行階段規則。",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
