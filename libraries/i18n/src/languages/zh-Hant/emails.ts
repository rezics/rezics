import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "這是系統自動傳送的郵件，請勿直接回覆。",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}。保留所有權利。`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `重設你的 ${verbatimTerms.rezics.value} 密碼`,
		preview: `重設你的 ${verbatimTerms.rezics.value} 密碼`,
		heading: "重設密碼",
		body: "我們收到重設你帳號密碼的要求。請在一小時內使用下方按鈕設定新密碼。",
		actionLabel: "重設密碼",
		fallback: "若按鈕無法使用，請開啟以下連結：",
		ignoreNotice: "若你沒有提出這項要求，可以忽略這封郵件；你的密碼不會變更。",
	},
	verifyEmail: {
		subject: `驗證你的 ${verbatimTerms.rezics.value} 電子郵件`,
		preview: `驗證你的 ${verbatimTerms.rezics.value} 電子郵件`,
		heading: "驗證電子郵件",
		body: "請確認這個電子郵件地址屬於你，以完成帳號設定。",
		actionLabel: "驗證電子郵件",
		fallback: "若按鈕無法使用，請開啟以下連結：",
		ignoreNotice: "若你沒有建立帳號或要求驗證，可以忽略這封郵件。",
	},
};
