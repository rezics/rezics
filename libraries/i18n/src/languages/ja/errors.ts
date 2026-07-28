import { insert } from "native-i18n";

export default {
	unknown: "予期しないエラーが発生しました。",
	unknownWithCode: insert("予期しないエラーが発生しました ({{code}})。", { code: String }),
	unauthorized: "続行するにはサインインしてください。",
	forbidden: "この操作を行う権限がありません。",
	notFound: "このコンテンツは見つかりませんでした。",
	conflict: "このコンテンツは変更されました。更新してもう一度試してください。",
	invalid: "提出されたコンテンツは無効です。",
	unavailable: "サービスは一時的に利用できません。後でもう一度お試しください。",
} satisfies typeof import("../zh-Hant/errors").default;
