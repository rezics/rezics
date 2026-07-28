import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "これは自動送信メールです。このメールに返信しないでください。",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}. 無断転載を禁じます。`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `${verbatimTerms.rezics.value} のパスワードをリセットする`,
		preview: `${verbatimTerms.rezics.value} のパスワードをリセットする`,
		heading: "パスワードをリセットする",
		body: "アカウントのパスワードリセットのリクエストを受け取りました。下のボタンを1時間以内に使用して新しいパスワードを選択してください。",
		actionLabel: "パスワードをリセット",
		fallback: "ボタンが機能しない場合は、次のリンクを開いてください：",
		ignoreNotice:
			"このリクエストをあなたが行っていない場合は、このメールを無視して構いません。パスワードは変更されません。",
	},
	verifyEmail: {
		subject: `${verbatimTerms.rezics.value} のメールアドレスを確認する`,
		preview: `${verbatimTerms.rezics.value} のメールアドレスを確認する`,
		heading: "メールを確認する",
		body: "アカウントの設定を完了するために、このメールアドレスがあなたのものであることを確認してください。",
		actionLabel: "メールを確認",
		fallback: "ボタンが機能しない場合は、次のリンクを開いてください：",
		ignoreNotice:
			"アカウントを作成していない、または確認をリクエストしていない場合は、このメールを無視して構いません。",
	},
} satisfies typeof import("../zh-Hant/emails").default;
