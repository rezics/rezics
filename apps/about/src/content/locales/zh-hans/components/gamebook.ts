import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "读者界面",
	journey: "本次 Journey",
	entrance: verbatimTerms.entranceNode.value,
	passageTitle: `${verbatimTerms.passageNode.value}：档案入口`,
	branchDescription: `读者到达一个已有记录的分支。选择的路径会记录为 ${verbatimTerms.journeyStep.value}，与一般 Progress 分开。`,
	choose: "做出选择",
	choiceA: "选择 A · 继续前往阅览室",
	choiceAOutcome: `${verbatimTerms.passageNode.value}：阅览室`,
	choiceAStep: "选择 A → 阅览室",
	choiceB: "选择 B · 离开档案馆",
	choiceBOutcome: `${verbatimTerms.endingNode.value}：稍后再来`,
	choiceBStep: `选择 B → ${verbatimTerms.endingNode.value}`,
	authoring: "作者编辑器",
	validation: `结构有效 · ${verbatimTerms.dag.value} 检查通过`,
	authoringSequence: `${verbatimTerms.gameContentStructure.value} 创作序列`,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: "入口",
	choicesTwo: "选择：2",
	retirable: "可退役",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · 不含循环、脚本、变量、战斗或运行时规则。`,
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
