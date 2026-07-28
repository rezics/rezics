import Summary from "./summary.md";
import summaryText from "./summary.md?raw";
import Scenarios from "./scenarios.md";
import Workflow from "./workflow.md";
import Boundaries from "./boundaries.md";
import questions from "./faq/questions";
import PreviewAnswer from "./faq/preview.md";
import StatusAnswer from "./faq/status.md";

const content = {
	Summary,
	summaryText: summaryText.trim(),
	Scenarios,
	Workflow,
	Boundaries,
	faq: [
		{ question: questions.preview, Answer: PreviewAnswer },
		{ question: questions.status, Answer: StatusAnswer },
	],
} satisfies typeof import("../../../en/products/token/index").default;

export default content;
