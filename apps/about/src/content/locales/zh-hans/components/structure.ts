import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `结构有效 · ${verbatimTerms.dag.value} 检查通过`,
	structure: "结构编辑器",
	treeMode: "树模式",
	gameMode: "游戏模式",
	path: "Content Structure / Book 适配器",
	orderedTree: `${verbatimTerms.contentStructure.value} · 有序树`,
	bookRoot: "Book 根节点",
	partOccurrence: "第一部分 · occurrence",
	postAOccurrence: `${zhHansTerminology.post.forms.label} A · occurrence 01`,
	postBOccurrence: `${zhHansTerminology.post.forms.label} B · occurrence 02`,
	reusedOccurrence: `${zhHansTerminology.post.forms.label} A · 复用的 occurrence 03`,
	bookReaderResult: "Book 阅读器结果",
	partOne: "第一部分",
	section: "分区",
	chapterOne: "章节 01",
	chapterTwo: "章节 02",
	postA: `${zhHansTerminology.post.forms.label} A`,
	postB: `${zhHansTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · 可选图层`,
	entrance: verbatimTerms.entranceNode.value,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: verbatimTerms.entryEdge.value,
	choiceAB: "选择 A / B",
	terminal: verbatimTerms.terminalEdge.value,
	gamebookReaderResult: "GameBook 阅读器结果",
	currentPassage: `当前 ${verbatimTerms.passageNode.value}`,
	stableId: `稳定 ${verbatimTerms.id.value}`,
	availableChoices: "可用选择",
	choicesCount: "2",
	journeyStep: verbatimTerms.journeyStep.value,
	separate: "分开记录",
} satisfies typeof import("../../en/components/structure").default;

export default content;
