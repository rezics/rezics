import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";

const content = {
	breadcrumbsHome: "ホーム",
	breadcrumbsProducts: "プロダクト",
	names: {
		catalog: "カタログ",
		book: "書籍",
		gamebook: "ゲームブック",
		media: "メディア",
		software: "ソフトウェア",
		series: "シリーズ",
		release: "リリース",
		post: jaTerminology.post.forms.label,
		wiki: "ウィキ",
		picture: "画像",
		review: "レビュー",
		collection: "コレクション",
		library: "ライブラリ",
		realm: jaTerminology.realm.forms.label,
		zone: jaTerminology.zone.forms.label,
		comment: "コメント",
		score: "スコア",
		"content-structure": "コンテンツ構造",
		history: "履歴",
		editor: "エディター",
		feed: "フィード",
		tag: "タグ",
		progress: "進捗",
		entity: "エンティティ",
		"api-oauth": `${verbatimTerms.api.value} と ${verbatimTerms.oauth.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: "書籍 + ゲームコンテンツ構造 → ゲームブック",
		wiki: `${jaTerminology.post.forms.label}（${verbatimTerms.kindWiki.value}）→ ウィキ`,
		picture: `${jaTerminology.post.forms.label}（${verbatimTerms.kindPicture.value}）→ 画像`,
		review: `${jaTerminology.post.forms.label}（${verbatimTerms.kindReview.value}）→ レビュー`,
		library: `コレクション（${verbatimTerms.collectionArray.value}）→ ライブラリ`,
	},
	capabilityModeLabels: {
		ContentStructure: "コンテンツ構造",
		GameContentStructure: "ゲームコンテンツ構造",
		Entity: "エンティティ",
		CreditAttribution: "貢献の帰属",
		SubjectAssociation: "主題の関連付け",
	},
	scenarios: "利用シーン",
	workflow: "主要ワークフロー",
	capabilities: "利用する共有機能",
	boundaries: "プロダクトの境界",
	faq: "よくある質問",
	statusLabel: "状態",
	classificationLabel: "種類",
	consumers: "この機能を使うプロダクト",
	sectionEyebrows: {
		use: "用途",
		workflow: "ワークフロー",
		platform: "プラットフォーム",
		scope: "範囲",
		faq: "よくある質問",
		next: "次に見る",
	},
} satisfies typeof import("../../en/products/common").default;

export default content;
