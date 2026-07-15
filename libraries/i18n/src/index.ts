import zhCN from "./languages/zh-CN";

export const Languages = [
	{ tag: "zh-CN", data: zhCN },
	{ tag: "en-US", data: () => import("./languages/en-US").then((module) => module.default) },
] as const;

export type LanguageTag = (typeof Languages)[number]["tag"];
export type Translation = typeof zhCN;
