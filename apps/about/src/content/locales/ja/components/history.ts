import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "バージョン",
	publishedVersions: "公開済みバージョン",
	fieldHistory: "フィールド履歴",
	diff: "フィールド差分",
	locked: "このフィールドは現在の編集範囲でロック中です",
	bookTitle: verbatimTerms.bookTitleField.value,
	postBlock: verbatimTerms.postBlockField.value,
	zoneConfig: verbatimTerms.zoneConfigField.value,
	publishedVersionC: "公開バージョン C",
	publishedVersionB: "公開バージョン B",
	publishedVersionA: "公開バージョン A",
	current: "現在",
	previous: "以前",
	initial: "初期",
	previousTitle: "以前のタイトル",
	currentTitle: "現在公開中のタイトル",
	postBlockHistory: "Post ブロック履歴",
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / 公開 B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / 公開 C`,
	zoneConfigurationHistory: "Zone 設定履歴",
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / 公開 A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / 公開 B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
