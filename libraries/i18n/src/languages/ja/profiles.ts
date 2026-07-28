import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: postTerms } = jaTerminology.post;

export default {
	memberSince: insert("{{date}} に参加しました", { date: String }),
	editProfile: "プロフィールを編集",
	tabsLabel: "プロフィールページ",
	tabs: {
		profile: "プロフィール",
		content: "コンテンツ",
	},
	aboutTitle: "情報",
	aboutEmpty: "このユーザーはまだ詳細な紹介を追加していません。",
	contentTitle: "公開されたコンテンツ",
	contentDescription: `このユーザー名義の公開${postTerms.pluralLabel}とレビュー、およびこのユーザーが所有するコレクションとカタログ項目。`,
	contentEmptyTitle: "まだ公開されたコンテンツはありません",
	contentEmptyDescription: "このユーザーが公開または所有する公開コンテンツはここに表示されます。",
} satisfies typeof import("../zh-Hant/profiles").default;
