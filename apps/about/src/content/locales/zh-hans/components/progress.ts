import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	generalProgress: "一般 Progress",
	readingPosition: "阅读位置",
	unit: "Unit",
	book: "Book",
	occurrence: "Occurrence",
	chapter: "Chapter",
	position: "位置",
	readerState: "读者状态",
	gamebookBoundary: "GameBook 边界",
	progress: "Progress",
	generalSummary: "一般摘要",
	journey: "Journey",
	gamebookOwned: "由 GameBook 管理",
	journeyStep: verbatimTerms.journeyStep.value,
	pathHistory: "路径历史",
} satisfies typeof import("../../en/components/progress").default;

export default content;
