import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { insert } from "native-i18n";

const { forms: realmTerms } = jaTerminology.realm;
const { forms: zoneTerms } = jaTerminology.zone;
const { forms: entityTerms } = jaTerminology.entity;

export default {
	loading: "編集者を読み込み中…",
	loadFailed: "エディタを読み込めませんでした。",
	paragraph: "段落",
	heading2: "見出し 2",
	heading3: "見出し 3",
	quote: "引用",
	bold: "太字",
	italic: "斜体",
	bulletList: "箇条書きリスト",
	numberedList: "番号付きリスト",
	link: "リンク",
	linkPrompt: `${verbatimTerms.http.value}、${verbatimTerms.https.value}、${verbatimTerms.mailto.value} または相対的な ${verbatimTerms.url.value} を使用します。`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "新しいタブで開く",
	addLink: "リンクを追加",
	removeLink: "リンクを削除",
	invalidLink: `サポートされている ${verbatimTerms.url.value} を入力してください。`,
	spoiler: "ネタバレ",
	addSpoiler: "ネタバレとしてマーク",
	removeSpoiler: "ネタバレを解除",
	showSpoiler: "ネタバレを表示",
	showScopedSpoiler: insert("「{{title}}」のネタバレを表示", { title: String }),
	spoilerPreview: "ネタバレ内容",
	spoilerScope: "関連する項目（任意）",
	spoilerScopePlaceholder: "項目を検索",
	spoilerRange: "適用範囲",
	spoilerRangeSelection: "選択中のテキスト",
	spoilerRangeBlocks: "選択中のブロック",
	spoilerRangeBody: "本文全体",
	spoilerLinkConflict: "リンクのテキストをネタバレとしてマークすることはできません。",
	spoilerTextOnlyHint:
		"テキストのみがマークされ、画像やその他の埋め込みコンテンツは表示されたままです。",
	undo: "元に戻す",
	redo: "やり直す",
	style: "文字スタイル",
	preview: "プレビュー",
	placeholder: "文章を書くか、ブロックのために / と入力してください。",
	slashMenu: "挿入",
	slashHint: `ブロックを挿入するには /、ユニットをメンションするには ${verbatimTerms.profileSlugPrefix.value}、t/、e/、r/、z/ を入力します。`,
	mentionSearchPrompt: "検索するために入力",
	mentionUsers: "ユーザー",
	mentionTags: "タグ",
	mentionEntities: entityTerms.label,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "利用できないユニット",
	richText: "リッチテキスト",
	toolbar: "フォーマットツールバー",
} satisfies typeof import("../zh-Hant/editor").default;
