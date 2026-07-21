import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	resetPassword: {
		subject: `重設你的 ${verbatimTerms.rezics.value} 密碼`,
		text: insert("請在一小時內開啟以下連結以重設密碼：{{url}}", { url: String }),
	},
	verifyEmail: {
		subject: `驗證你的 ${verbatimTerms.rezics.value} 電子郵件`,
		text: insert("請開啟以下連結完成電子郵件驗證：{{url}}", { url: String }),
	},
};
