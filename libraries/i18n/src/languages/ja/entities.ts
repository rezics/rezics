import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = jaTerminology.entity;

export default {
	contextMeasurements: {
		title: "内容ごとの身体計測値",
		context: "関連する内容",
		chooseContext: "作品・版・リリース・番組を選択",
		noVisibleMeasurement: "この内容では現在閲覧できる計測値がありません。",
		edit: "この内容の計測値を編集",
		millimetres: "ミリメートル",
		grams: "グラム",
		scopeNotice:
			"これらの値は選択した内容だけに適用されます。保存すると、その内容の計測値一式を置き換えます。",
		unknownNotice: "不明な値は空欄にしてください。ゼロはゼロとして保存されます。",
		invalid: "対応範囲内の非負整数を入力するか、不明な値を空欄にしてください。",
		save: "この内容の計測値を保存",
	},
	entities: entityTerms.pluralLabel,
	tags: "タグ",
	kind: "種類",
	verification: "確認",
	owner: "所有者",
	verified: "認証済み",
	unverified: "未認証",
	measurements: "身体データ",
	height: "身長",
	weight: "体重",
	bust: "バスト",
	waist: "ウエスト",
	hips: "ヒップ",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `新しい${entityTerms.label}`,
	newTag: "新しいタグ",
	externalLinksDescription: `${entityTerms.inline}に関する情報の根拠となる公開ページです。`,
	externalLinksEmpty: "外部リンクはまだありません。",
	relatedContentTitle: "関連コンテンツ",
	relatedContentDescription: `${entityTerms.inline}に関連するコンテンツです。`,
	relatedContentEmptyTitle: "関連コンテンツはありません",
	relatedContentEmptyDescription: "表示できる関連コンテンツはまだありません。",
} satisfies typeof import("../zh-Hant/entities").default;
