import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `유효한 구조 · ${verbatimTerms.dag.value} 검사 통과`,
	structure: "구조 편집기",
	treeMode: "Tree 모드",
	gameMode: "Game 모드",
	path: "Content Structure / Book 어댑터",
	orderedTree: `${verbatimTerms.contentStructure.value} · 순서형 트리`,
	bookRoot: "Book 루트",
	partOccurrence: "파트 I · occurrence",
	postAOccurrence: `${koTerminology.post.forms.label} A · occurrence 01`,
	postBOccurrence: `${koTerminology.post.forms.label} B · occurrence 02`,
	reusedOccurrence: `${koTerminology.post.forms.label} A · 재사용 occurrence 03`,
	bookReaderResult: "Book 리더 결과",
	partOne: "파트 I",
	section: "섹션",
	chapterOne: "제01장",
	chapterTwo: "제02장",
	postA: `${koTerminology.post.forms.label} A`,
	postB: `${koTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · 선택적 그래프 레이어`,
	entrance: verbatimTerms.entranceNode.value,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: "시작점",
	choiceAB: "선택지 A / B",
	terminal: "종단",
	gamebookReaderResult: "GameBook 리더 결과",
	currentPassage: `현재 ${verbatimTerms.passageNode.value}`,
	stableId: `안정적 ${verbatimTerms.id.value}`,
	availableChoices: "선택 가능한 항목",
	choicesCount: "2",
	journeyStep: verbatimTerms.journeyStep.value,
	separate: "분리",
} satisfies typeof import("../../en/components/structure").default;

export default content;
