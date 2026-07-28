import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "이것은 자동 발송된 메시지입니다. 이 이메일에 회신하지 마세요.",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}. 판권 소유.`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `${verbatimTerms.rezics.value} 비밀번호 재설정`,
		preview: `${verbatimTerms.rezics.value} 비밀번호 재설정`,
		heading: "비밀번호 재설정",
		body: "계정 비밀번호 재설정 요청을 받았습니다. 아래 버튼을 한 시간 내에 사용하여 새 비밀번호를 선택하세요.",
		actionLabel: "비밀번호 재설정",
		fallback: "버튼이 작동하지 않으면, 이 링크를 열어주세요:",
		ignoreNotice:
			"이 요청을 하지 않았다면, 이 이메일을 무시할 수 있습니다. 비밀번호는 변경되지 않습니다.",
	},
	verifyEmail: {
		subject: `${verbatimTerms.rezics.value} 이메일 주소 확인`,
		preview: `${verbatimTerms.rezics.value} 이메일 주소 확인`,
		heading: "이메일 확인",
		body: "계정 설정을 완료하려면 이 이메일 주소가 본인 것임을 확인하세요.",
		actionLabel: "이메일 인증",
		fallback: "버튼이 작동하지 않으면, 이 링크를 열어주세요:",
		ignoreNotice: "계정을 생성하거나 확인 요청을 하지 않았다면, 이 이메일을 무시하세요.",
	},
} satisfies typeof import("../zh-Hant/emails").default;
