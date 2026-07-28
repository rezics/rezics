import { insert } from "native-i18n";

export default {
	unknown: "예상치 못한 오류가 발생했습니다.",
	unknownWithCode: insert("예상치 못한 오류가 발생했습니다 ({{code}}).", { code: String }),
	unauthorized: "계속하려면 로그인하세요.",
	forbidden: "권한이 없어 해당 작업을 수행할 수 없습니다.",
	notFound: "이 콘텐츠를 찾을 수 없습니다.",
	conflict: "이 콘텐츠가 변경되었습니다. 새로고침하고 다시 시도하세요.",
	invalid: "제출된 내용이 유효하지 않습니다.",
	unavailable: "서비스가 일시적으로 이용 불가합니다. 나중에 다시 시도하세요.",
} satisfies typeof import("../zh-Hant/errors").default;
