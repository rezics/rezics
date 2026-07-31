import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: realmTerms } = jaTerminology.realm;
const { forms: zoneTerms } = jaTerminology.zone;
const { forms: entityTerms } = jaTerminology.entity;

export default {
	memberSince: insert("{{date}} に参加しました", { date: String }),
	editProfile: "プロフィールを編集",
	tabsLabel: "プロフィールページ",
	tabs: {
		profile: "プロフィール",
		activity: "アクティビティ",
		content: "コンテンツ",
	},
	aboutTitle: "情報",
	aboutEmpty: "このユーザーはまだ詳細な紹介を追加していません。",
	activityTitle: "評価と進捗",
	activityDescription:
		"各項目と全体のプライバシー設定に従って、表示可能な評価と現在の進捗を掲載します。",
	activityEmpty: "表示できる評価や進捗はまだありません。",
	activityScores: "評価",
	activityProgress: "進捗",
	activityScoreRealm: insert(`${realmTerms.label}：{{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "未開始",
		active: "進行中",
		paused: "一時停止",
		completed: "完了",
		dropped: "中止",
	},
	contentTitle: "公開コンテンツ",
	contentDescription: `このユーザーに直接、またはこのユーザーを発行者としてクレジットする${entityTerms.inline}を通じて帰属する公開コンテンツと、このユーザーが所有する${realmTerms.pluralLabel}および${zoneTerms.pluralLabel}を表示します。`,
	contentEmptyTitle: "まだ公開されたコンテンツはありません",
	contentEmptyDescription: `クレジットされた公開コンテンツと、所有する${realmTerms.pluralLabel}または${zoneTerms.pluralLabel}はここに表示されます。`,
} satisfies typeof import("../zh-Hant/profiles").default;
