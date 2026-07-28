import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: realmTerms } = koTerminology.realm;

export default {
	eyebrow: "함께 큐레이션하고 신중하게 논의",
	title: "유닛, 관계 및 지식이 함께 성장하는 장소",
	description: `책, 소프트웨어, 미디어를 탐색하고, 진행 상황을 추적하며, ${realmTerms.inline}로 항목을 개선하세요`,
	latest: "최근 추가됨",
} satisfies typeof import("../zh-Hant/home").default;
