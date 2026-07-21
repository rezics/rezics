import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	generalProgress: "一般進捗",
	readingPosition: "読書位置",
	unit: "Unit",
	book: "Book",
	occurrence: "Occurrence",
	chapter: "Chapter",
	position: "Position",
	readerState: "読者状態",
	gamebookBoundary: "GameBook の境界",
	progress: "Progress",
	generalSummary: "全体概要",
	journey: "Journey",
	gamebookOwned: "GameBook 管理",
	journeyStep: verbatimTerms.journeyStep.value,
	pathHistory: "経路履歴",
} satisfies typeof import("../../en/components/progress").default;

export default content;
