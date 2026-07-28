import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} 또는 ${verbatimTerms.avif.value}`;

export default {
	title: "표지",
	choose: "이미지 선택, 삭제 또는 붙여넣기",
	hint: `${SupportedImageFormats}, 최대 10 ${verbatimTerms.mib.value}`,
	upload: "표지 업로드",
	replace: "교체",
	remove: "제거",
	cancel: "취소",
	inherit: "현지화 순서에서 사용 가능한 첫 번째 표지 사용",
	invalid: `10 ${verbatimTerms.mib.value} 이하의 ${SupportedImageFormats} 이미지를 선택하세요.`,
	failed: "표지를 업로드할 수 없습니다. 다시 시도하세요.",
} satisfies typeof import("../zh-Hant/cover").default;
