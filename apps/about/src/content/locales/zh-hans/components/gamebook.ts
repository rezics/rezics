const content = {
	reader: "读者界面",
	journey: "本次 Journey",
	entrance: "Entrance",
	passageTitle: "Passage：档案入口",
	branchDescription:
		"读者到达一个已有记录的分支。选择的路径会记录为 JourneyStep，与一般 Progress 分开。",
	choose: "做出选择",
	choiceA: "选择 A · 继续前往阅览室",
	choiceAOutcome: "Passage：阅览室",
	choiceAStep: "选择 A → 阅览室",
	choiceB: "选择 B · 离开档案馆",
	choiceBOutcome: "Ending：稍后再来",
	choiceBStep: "选择 B → Ending",
	authoring: "作者编辑器",
	validation: "结构有效 · DAG 检查通过",
	authoringSequence: "GameContentStructure 创作序列",
	passage: "Passage",
	ending: "Ending",
	entry: "入口",
	choicesTwo: "选择：2",
	retirable: "可退役",
	constraints: "Entrance → Passage → Ending · 不含循环、脚本、变量、战斗或运行时规则。",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
