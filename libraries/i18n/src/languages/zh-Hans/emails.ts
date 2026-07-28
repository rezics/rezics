import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "这是系统自动发送的邮件，请勿直接回复。",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}。保留所有权利。`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `重设你的 ${verbatimTerms.rezics.value} 密码`,
		preview: `重设你的 ${verbatimTerms.rezics.value} 密码`,
		heading: "重设密码",
		body: "我们收到重设你账户密码的要求。请在一小时内使用下方按钮设置新密码。",
		actionLabel: "重设密码",
		fallback: "若按钮无法使用，请打开以下链接：",
		ignoreNotice: "若你没有提出这项要求，可以忽略这封邮件；你的密码不会变更。",
	},
	verifyEmail: {
		subject: `验证你的 ${verbatimTerms.rezics.value} 电子邮件`,
		preview: `验证你的 ${verbatimTerms.rezics.value} 电子邮件`,
		heading: "验证电子邮件",
		body: "请确认这个电子邮件地址属于你，以完成账户设置。",
		actionLabel: "验证电子邮件",
		fallback: "若按钮无法使用，请打开以下链接：",
		ignoreNotice: "若你没有创建账户或要求验证，可以忽略这封邮件。",
	},
} satisfies typeof import("../zh-Hant/emails").default;
