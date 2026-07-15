export default {
	unknown: "发生了意外错误。",
	unknownWithCode: (code: string) => `发生了意外错误（${code}）。`,
	unauthorized: "请先登录后继续。",
	forbidden: "你没有执行此操作的权限。",
	notFound: "没有找到这个内容。",
	conflict: "内容已发生变化，请刷新后重试。",
	invalid: "提交的内容不符合要求。",
	unavailable: "服务暂时不可用，请稍后重试。",
};
