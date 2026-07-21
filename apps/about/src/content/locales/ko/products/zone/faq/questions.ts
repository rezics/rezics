import { koTerminology } from "@rezics/i18n/terminology/ko";

const content = {
	preview: `${koTerminology.zone.forms.inline} 화면은 실제 제품 스크린샷인가요?`,
	status: "구현 상태는 어떻게 결정하나요?",
} satisfies typeof import("../../../../en/products/zone/faq/questions").default;

export default content;
