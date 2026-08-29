import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: followTerms } = jaTerminology.follow;
const { forms: labelTerms } = jaTerminology.label;
const { forms: postTerms } = jaTerminology.post;
const { forms: videoTerms } = jaTerminology.video;
const { forms: audioTerms } = jaTerminology.audio;
const { forms: realmTerms } = jaTerminology.realm;
const { forms: entityTerms } = jaTerminology.entity;
const { forms: unitSlugTerms } = jaTerminology.unitSlug;
const { forms: zoneTerms } = jaTerminology.zone;
const { forms: customThemeTerms } = jaTerminology.customTheme;

export default {
	home: "ホーム",
	studio: verbatimTerms.studio.value,
	units: "ユニット",
	entity: entityTerms.label,
	realm: realmTerms.label,
	collections: "コレクション",
	favorites: "保存済み",
	progress: "進行状況",
	me: "自分",
	skipToContent: "メインコンテンツにスキップ",
	navigation: "ナビゲーション",
	content: "コンテンツ",
	userMenu: {
		label: "ユーザーメニュー",
		description: "プロフィールの表示、設定やオプションの調整、またはサインアウトを行う。",
		back: "ユーザーメニューに戻る",
		close: "ユーザーメニューを閉じる",
		viewProfile: "プロフィールを表示",
		myContent: "自分のコンテンツ",
		myReports: "自分の報告",
		settings: "設定",
		console: "管理コンソール",
		invitations: "受け取ったアクセス招待",
		signOut: "サインアウト",
	},
	sidebar: {
		title: "メインナビゲーション",
		description: `ホーム、よく行く場所、および ${zoneTerms.pluralLabel} と ${realmTerms.pluralLabel} を開く ${followTerms.action}。`,
		open: "メインナビゲーションを開く",
		close: "メインナビゲーションを閉じる",
		expand: "サイドバーを展開",
		collapse: "サイドバーを折りたたむ",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `すべての ${zoneTerms.pluralLabel}`,
		allRealms: `すべての ${realmTerms.pluralLabel}`,
		zonesEmpty: `${zoneTerms.pluralLabel} あなた ${followTerms.action} はここに表示されます。`,
		realmsEmpty: `${realmTerms.pluralLabel} あなた ${followTerms.action} はここに表示されます。`,
		loading: "サイドバーの内容を読み込み中。",
		error: "サイドバーの内容を読み込めませんでした。",
	},
	following: {
		title: followTerms.collectionLabel,
		all: `すべての ${followTerms.gerund}`,
		empty: `あなた ${followTerms.action} のユニットはここに表示されます。`,
		description: `あなた ${followTerms.action} のユニットをフィルター、固定、整理。`,
		filter: `${followTerms.followed} ユニットタイプをフィルター`,
		favorite: "固定",
		unfavorite: "固定解除",
		types: {
			slug_namespace: `${unitSlugTerms.label} ネームスペース`,
			profile: "プロフィール",
			book: "書籍",
			software: "ソフトウェア",
			media: "メディア",
			video: videoTerms.label,
			audio: audioTerms.label,
			release: "リリース",
			entity: entityTerms.label,
			label: labelTerms.label,
			tag: "タグ",
			series: "シリーズ",
			zone: zoneTerms.label,
			zone_page: `${zoneTerms.label} ページ`,
			custom_theme: customThemeTerms.label,
			collection: "コレクション",
			post: postTerms.label,
			poll: "投票",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label} ルール`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
