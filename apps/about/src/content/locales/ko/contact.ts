import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `${verbatimTerms.rezics.value} 문의`,
		description: `${verbatimTerms.rezics.value} 개발 참여와 협업에 관해 프로젝트 관리자에게 문의하세요.`,
	},
	eyebrow: "문의하기",
	title: "열린 콘텐츠 기반을 함께 만들어요",
	introduction:
		"개발에 참여하거나 문제를 제보하거나 협업을 논의하고 싶다면 아래 채널로 연락해 주세요.",
	role: "프로젝트 관리자",
	emailLabel: "이메일",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
