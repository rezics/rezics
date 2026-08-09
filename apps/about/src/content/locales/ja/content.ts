import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const jaContent = {
	nav: {
		home: "ホーム",
		how: "仕組み",
		uses: "使い方",
		products: "機能一覧",
		enter: `${BRAND} を開く`,
		language: "言語",
		theme: "表示",
		openMenu: "メニューを開く",
		closeMenu: "メニューを閉じる",
	},
	theme: { light: "ライト", dark: "ダーク", toggle: "表示を切り替える" },
	a11y: {
		skipContent: "本文へ移動",
		primaryNavigation: "メインナビゲーション",
		utilityNavigation: "ユーティリティ",
		home: `${BRAND} ホーム`,
	},
	meta: {
		home: {
			title: `${BRAND} — 好きな物語に出会う`,
			description: "一つの作品識別が、版、内容、コミュニティ、言語を越えた知識をつなぎます。",
		},
		how: {
			title: `仕組み — ${BRAND}`,
			description: "作品識別から内容、履歴、コミュニティがつながる仕組みを説明します。",
		},
		uses: {
			title: `使い方 — ${BRAND}`,
			description: "読者、コミュニティ、作者、開発者が同じ作品ネットワークを使う方法。",
		},
		products: {
			title: `機能一覧 — ${BRAND}`,
			description: "作品、内容、コミュニティ、公開接続の全機能を確認できます。",
		},
	},
	home: {
		eyebrow: "継承 · 創作 · 伝播",
		title: "好きな物語に出会う。",
		lead: `${BRAND} は、多言語での利用を前提に設計された、コンテンツの整理・公開とコミュニティでの共同作業のためのプラットフォームです。作品、${jaTerminology.metadata.forms.inline}、${jaTerminology.post.forms.plural}、コレクション、分類、コミュニティ空間がそれぞれ安定した識別を持ち、一つのシステム上で関連付け、作成、管理、探索、議論、運営できます。`,
		explore: "使い方を見る",
		understand: "仕組みを知る",
		problem: {
			title: "愛しているのは同じ作品でも、見つかるのは断片です。",
			body: "言語、版、メディア、コミュニティごとに項目が分かれ、読者は何度も同じ作品を見分けます。帰属や知識もプラットフォームの境界で失われます。",
		},
		promise: {
			title: "まず作品を識別し、その周りで知識を育てる。",
			body: `${BRAND} は安定した作品識別から始めます。名前が翻訳され、内容が変化し、コミュニティが異なる視点を作っても、同じ追跡可能な対象を参照します。`,
		},
		principles: [
			{
				title: "継承",
				body: "作品がすでに持つ歴史、言語、版、コミュニティの記憶。",
			},
			{ title: "創作", body: "内容を書き、構造を作り、帰属を記録し、新しい理解を生みます。" },
			{ title: "伝播", body: "コミュニティ、公開規約、多言語の接続を通じて知識を広げます。" },
		],
		model: {
			title: "一つの識別から、層を重ねて完全な文脈へ。",
			body: "混同すべきでない意味を分け、明確な関係で結びます。",
			steps: [
				{
					title: "作品識別",
					body: "作品には言語や表示に左右されない安定した核があります。",
				},
				{
					title: "版と関係",
					body: `シリーズ、リリース、${jaTerminology.entity.forms.label}、タグ、帰属が現実の文脈を作ります。`,
				},
				{
					title: "内容と履歴",
					body: "コンテンツ構造、編集、履歴が順序、変更、再利用を保ちます。",
				},
				{
					title: "個人とコミュニティ",
					body: `コレクション、${jaTerminology.realm.forms.label}、${jaTerminology.zone.forms.label}、フィードが日常の体験を作ります。`,
				},
			],
		},
		outcomes: {
			title: "読者と、作品そのもののために。",
			body: "同じ基盤で発見の負担を減らし、創作の帰属を守り、作品とふさわしい読者を結びます。",
			cards: [
				{ title: "見つける", body: "言語を越えて作品、版、作者を見分けます。" },
				{
					title: "理解する",
					body: "構造、レビュー、ウィキ、履歴、関係から全体の文脈を読みます。",
				},
				{
					title: "続ける",
					body: "進捗を保ち、コミュニティへ参加し、知識を共有の記憶へ変えます。",
				},
			],
		},
		open: {
			title: "公開性は、記憶が続くための条件です。",
			body: `${BRAND} はオープンソース、持ち運べる内容、${jaTerminology.publicationLicense.forms.label}、権限付き ${API} で外部ツールと接続します。`,
		},
		closing: {
			title: "大切な一つの作品から始めましょう。",
			body: "作品、コミュニティ、育ちつつある知識を探索できます。",
			action: `${BRAND} を開く`,
		},
		contact: {
			title: "一緒に形にしたいアイデアはありますか。",
			body: "製品連携、オープンソースへの参加、コンテンツモデルについての相談、改善の提案など、ぜひお聞かせください。",
			action: "お問い合わせ",
		},
	},
	how: {
		eyebrow: "基盤から",
		title: "大きな目録ではなく、作品をつなぎ続ける方法。",
		lead: `${BRAND} は識別、表示、関係、内容、信頼、探索を順に組み立てます。各層が一つの意味を守るため、言語、メディア、コミュニティへ広げられます。`,
		stages: [
			{
				title: "1. 作品識別",
				body: `安定 ${verbatimTerms.id.value} が作品を識別し、ローカライズ名や種類${jaTerminology.metadata.forms.label}は別作品を作らずに変化できます。`,
			},
			{
				title: "2. 表示と種類",
				body: "書籍、メディア、ソフトウェアは固有の項目と体験を持ち、識別と関係を共有します。",
			},
			{
				title: "3. 関係と帰属",
				body: `シリーズ、リリース、${jaTerminology.entity.forms.label}、タグ、創作帰属、主題の関係が理解可能なネットワークを作ります。`,
			},
			{
				title: "4. コンテンツブロックとコンテンツ構造",
				body: "コンテンツブロックは表示内容を表し、コンテンツ構造は配置、順序、再利用、分岐を管理します。",
			},
			{
				title: "5. 履歴、ライセンス、統治",
				body: "公開境界が追跡可能な版を作り、ライセンス、アクセス規則、統治が権限と信頼を示します。",
			},
			{
				title: "6. 探索画面",
				body: `検索、フィード、${jaTerminology.realm.forms.label}、${jaTerminology.zone.forms.label}が、見つけ、読み、参加し、戻る道を作ります。`,
			},
		],
		integrity: {
			title: "意味を分け、価値としてつなぐ。",
			body: "識別は題名ではなく、リリースはシリーズではなく、内容ブロックは構造ノードではありません。明確な境界が関係を説明可能にします。",
		},
	},
	uses: {
		eyebrow: "必要から始める",
		title: "一つの作品ネットワークに、さまざまな旅。",
		lead: "読者はデータモデルを先に学ぶ必要はありません。本を探す、シリーズを追う、コミュニティに参加する、進捗を残すところから始めます。",
		resultLabel: "得られること",
		journeys: [
			{
				title: "言語を越えて同じ作品を見つける",
				body: "翻訳名、原題、作者、版、メディアから入り、関係を少しずつ確認します。",
				result: "繰り返し検索せず、信頼できる一つの入口を得ます。",
			},
			{
				title: "版と創作の文脈を理解する",
				body: "シリーズ、リリース、人物、組織、キャラクター、出版社の違いを保って見ます。",
				result: "何を見ているか、どこから来たかが分かります。",
			},
			{
				title: "読み、知識を加える",
				body: `書籍構造、${jaTerminology.post.forms.label}、ウィキ、画像、レビュー、スコアを読み、自分の理解を加えます。`,
				result: "内容が説明対象の作品から離れません。",
			},
			{
				title: "関心を共有するコミュニティへ",
				body: `${jaTerminology.realm.forms.label}で共通規則を作り、${jaTerminology.zone.forms.label}で視点を選び、フィードで議論を続けます。`,
				result: "知識が流れて消えるメッセージだけになりません。",
			},
			{
				title: "集め、戻り、続ける",
				body: "コレクションとライブラリで整理し、進捗を保存して同じ文脈へ戻ります。",
				result: "個人の旅と共有知識が支え合います。",
			},
			{
				title: "帰属と条件を保って公開する",
				body: `内容構造、貢献関係、${jaTerminology.publicationLicense.forms.label}、履歴をそろえます。`,
				result: "由来を失わずに理解、参照、再利用できます。",
			},
			{
				title: "ツールと新しい入口を作る",
				body: `${API}、${OAUTH}、範囲付きトークンで検索、編集、コミュニティ作業を同じ識別へ接続します。`,
				result: "新しいデータ孤島を作らず、ネットワークを拡張します。",
			},
		],
		closing: {
			title: "すべての機能のつながりを見る",
			body: "作品識別から公開接続まで、価値、流れ、関係、境界を確認できます。",
			action: "全機能を見る",
		},
	},
	products: {
		eyebrow: "完全な一覧",
		title: "作品識別から公開エコシステムまで。",
		lead: "26 の機能をモデル上の位置で並べています。ばらばらの機能ではなく、作品を識別し共有知識を続けるための道です。",
		searchLabel: "機能を検索",
		searchPlaceholder: "名前または用途",
		allLayers: "すべて",
		empty: "一致する機能はありません。",
		openProduct: "機能を見る",
		layers: {
			identity: {
				title: "識別と関係",
				body: `作品を識別し、版、シリーズ、${jaTerminology.entity.forms.label}、分類をつなぎます。`,
			},
			form: {
				title: "内容の形",
				body: "読む、見る、作る、評価する、応答する体験を支えます。",
			},
			structure: { title: "構造と記憶", body: "内容を構成し、公開、差分、変化を保ちます。" },
			community: {
				title: "個人とコミュニティ",
				body: "集め、選び、議論し、追い、戻ります。",
			},
			open: {
				title: "公開エコシステム",
				body: "明確な権限でツールと新しい入口を接続します。",
			},
		},
	},
	product: {
		breadcrumbHome: "ホーム",
		breadcrumbProducts: "機能一覧",
		layerLabel: "層",
		related: "関連機能",
		readNext: "次に読む",
		enter: `${BRAND} を開く`,
	},
	footer: {
		statement: "好きな物語に出会い、知識を受け継ぎ、作り、広げる。",
		explore: "探索",
		project: "プロジェクト",
		source: `${GITHUB} ソース`,
		mainSite: "メインサイト",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "ページが見つかりません",
		body: "アドレスが変わったか、内容が存在しません。",
		back: "ホームへ戻る",
	},
} satisfies SiteCopy;
