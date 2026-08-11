import { insert } from "native-i18n";

export default {
	title: "다이렉트 메시지",
	conversationWith: insert("{{name}}님과의 대화", { name: String }),
	description: "이 비공개 대화에서 메시지를 확인하고 보낼 수 있습니다.",
	unknownParticipant: "알 수 없는 사용자",
	backToNotifications: "알림으로 돌아가기",
	loadOlder: "이전 메시지 불러오기",
	emptyTitle: "아직 메시지가 없습니다",
	emptyDescription: "첫 메시지를 보내 대화를 시작하세요.",
	deletedMessage: "삭제된 메시지입니다.",
	you: "나",
	composeLabel: "메시지 작성",
	placeholder: "메시지 입력",
	send: "보내기",
} satisfies typeof import("../zh-Hant/messages").default;
