import { insert } from "native-i18n";

export default {
	unknown: "发生了意外错误。",
	unknownWithCode: insert("发生了意外错误（{{code}}）。", { code: String }),
	unauthorized: "请先登录再继续。",
	forbidden: "你没有运行此操作的权限。",
	notFound: "找不到这个内容。",
	conflict: "内容已变更，请刷新后再试一次。",
	invalid: "提交的内容不符合要求。",
	unavailable: "服务暂时不可用，请稍后重试。",
} satisfies typeof import("../zh-Hant/errors").default;
