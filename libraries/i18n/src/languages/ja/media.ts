import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}、${verbatimTerms.png.value}、${verbatimTerms.webp.value}、または ${verbatimTerms.avif.value}`;

export default {
	choose: "画像を選択、削除、または貼り付け",
	hint: `${SupportedImageFormats}、最大 10 ${verbatimTerms.mib.value}`,
	replace: "置き換え",
	remove: "削除",
	cancel: "キャンセル",
	invalid: `10 ${verbatimTerms.mib.value} 未満の ${SupportedImageFormats} 画像を選択してください。`,
	current: "現在の言語上書き",
	displayPreview: "表示範囲",
	editPresentation: "表示範囲を調整",
	presentationEditor: {
		title: {
			avatar: "アバターを調整",
			banner: "バナーを調整",
			cover: "カバーを調整",
		},
		description: {
			avatar: "正方形のトリミング内で画像をドラッグしてズームします。円形のアバタープレビューは元の角を削除しません。",
			banner: "固定された4:1のトリミング内で画像をドラッグしてズームします。新しいバナーは左上から始まります。",
			cover: "デフォルトでは画像全体を保持するか、構図がより重要な場合は固定の3:4トリミングに切り替えます。",
		},
		close: "画像調整を閉じる",
		loading: "元の画像を読み込み中…",
		loadFailed: "元の画像またはその表示を読み込むことができませんでした。",
		cropArea:
			"画像トリミングエリア。ドラッグして位置を調整し、マウスホイールでズームするか、矢印キーで移動します。",
		zoom: "ズーム",
		zoomIn: "ズームイン",
		zoomOut: "ズームアウト",
		reset: "リセット",
		avatarPreview: "円形プレビュー",
		bannerPreview: "バナープレビュー",
		coverPreview: "完全なカバープレビュー",
		coverMode: {
			label: "カバー表示モード",
			contain: "画像全体を表示",
			crop: "3:4にトリミング",
			containDescription:
				"完全な画像はそのまま表示されます。フレームは比率が異なる場合にぼかし背景を使用します。",
			cropDescription: "選択された3:4の範囲のみが配信および表示されます。",
		},
		cancel: "キャンセル",
		save: "表示範囲を保存",
		saveFailed: "表示範囲を保存できませんでした。もう一度お試しください。",
	},
	avatarPicker: {
		setup: "アバターを設定",
		edit: "アバターを編集",
		dialogTitle: "アバターを選択",
		dialogDescription: "画像をアップロードするか、アイコンまたは絵文字を選択してください。",
		close: "アバターピッカーを閉じる",
		source: "アバターの出典",
		useInherited: "継承されたアバターを使用",
		recent: "最近使用したもの",
		typeLabel: "アバターの種類",
		tabs: { image: "画像", icon: "アイコン", emoji: "絵文字" },
		preview: "アバタープレビュー",
		inherited: "継承アバター",
		icon: {
			search: "アイコンを検索",
			featured: "よく使われるアイコン",
			style: "アイコンのスタイル",
			styles: { fas: "ソリッド", fab: "ブランド" },
			loading: "アイコンを検索中…",
			empty: "該当するアイコンは見つかりませんでした。",
			failed: "現在アイコンを検索できません。後で再試行してください。",
			select: insert("アイコンを選択: {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} は設定されていないため、アイコンのプレビューを表示できません。`,
		},
		emoji: {
			search: "絵文字を検索",
			skinTone: "肌の色を変更",
			loading: "絵文字を読み込み中…",
			empty: "一致する絵文字は見つかりませんでした。",
		},
	},
	bannerPreview: {
		description: "配信されたバナーは保存された4:1の範囲を使用しています。",
		showOriginal: "画像全体を表示",
		hideOriginal: "画像全体を非表示",
		original: "画像全体",
	},
	roles: {
		avatar: {
			title: "アバター",
			inherit: "ローカライズ順で最初に利用可能なアバターを使用",
			failed: "アバターをアップロードできませんでした。もう一度お試しください。",
		},
		banner: {
			title: "バナー",
			inherit: "ローカライズ順で最初に利用可能なバナーを使用",
			failed: "バナーをアップロードできませんでした。もう一度お試しください。",
		},
		cover: {
			title: "カバー",
			inherit: "ローカリゼーション順で使用可能な最初の表紙を使用",
			failed: "表紙をアップロードできませんでした。再試行してください。",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
