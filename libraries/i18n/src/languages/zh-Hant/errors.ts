import { insert } from "native-i18n";

export default {
	unknown: "發生了意外錯誤。",
	unknownWithCode: insert("發生了意外錯誤（{{code}}）。", { code: String }),
	unauthorized: "請先登錄後繼續。",
	forbidden: "你沒有執行此操作的權限。",
	notFound: "沒有找到這個內容。",
	conflict: "內容已發生變化，請刷新後重試。",
	invalid: "提交的內容不符合要求。",
	unavailable: "服務暫時不可用，請稍後重試。",
};
