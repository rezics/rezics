import { make } from "i18n";

import enUS from "./en-US";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import jaJP from "./ja-JP";
import deDE from "./de-DE";

export const { set, get } = make("zh-CN", {
    "en-US": enUS,
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    "ja-JP": jaJP,
    "de-DE": deDE,
});
