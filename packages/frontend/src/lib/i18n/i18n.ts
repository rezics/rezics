import { create } from "@nmnmcc/intee/react";

import enUS from "./languages/en-US";

const en = { tag: "en-US", data: enUS } as const;
const zhCN = { tag: "zh-CN", data: () => import("./languages/zh-CN").then((m) => m.default) } as const;

export const { useTranslation, match } = create([en, zhCN]);

export type { Translation } from "./languages/en-US";
