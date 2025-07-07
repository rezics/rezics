import { make } from "i18n";

import enUS from "./en-US";
import zhCN from "./zh-CN";

export const { get } = make("zh-CN", {
    "en-US": enUS,
    "zh-CN": zhCN,
});
