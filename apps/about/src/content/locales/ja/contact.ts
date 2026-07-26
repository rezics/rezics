import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `${verbatimTerms.rezics.value} へのお問い合わせ`,
		description: `${verbatimTerms.rezics.value} の開発参加や協力について、プロジェクトメンテナーにお問い合わせいただけます。`,
	},
	eyebrow: "お問い合わせ",
	title: "オープンなコンテンツ基盤を一緒につくる",
	introduction:
		"開発への参加、不具合の報告、協力のご相談は、以下の連絡先からお気軽にお問い合わせください。",
	role: "プロジェクトメンテナー",
	emailLabel: "メール",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
