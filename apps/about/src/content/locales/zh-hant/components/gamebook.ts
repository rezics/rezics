const content = {
	reader: "讀者界面",
	journey: "本次 Journey",
	entrance: "Entrance",
	passageTitle: "Passage：檔案入口",
	branchDescription:
		"讀者到達一個已有記錄的分支。選擇的路徑會記錄為 JourneyStep，與一般 Progress 分開。",
	choose: "做出選擇",
	choiceA: "選擇 A · 繼續前往閱覽室",
	choiceAOutcome: "Passage：閱覽室",
	choiceAStep: "選擇 A → 閱覽室",
	choiceB: "選擇 B · 離開檔案館",
	choiceBOutcome: "Ending：稍後再來",
	choiceBStep: "選擇 B → Ending",
	authoring: "作者編輯器",
	validation: "結構有效 · DAG 檢查通過",
	authoringSequence: "GameContentStructure 創作序列",
	passage: "Passage",
	ending: "Ending",
	entry: "入口",
	choicesTwo: "選擇：2",
	retirable: "可退役",
	constraints: "Entrance → Passage → Ending · 不含循環、腳本、變數、戰鬥或執行階段規則。",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
