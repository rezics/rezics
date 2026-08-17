import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	attributions: [
		{
			name: "ドルフィン読書会",
			initials: "ド",
			summary: "思弁小説や批評、読書メモを一緒に読み深めるコミュニティです。",
		},
		{
			name: "森レナ",
			initials: "森",
			summary: "ネットワーク化された意識と、架空世界の社会関係について執筆しています。",
		},
		{
			name: "アーカイブ・シグナル",
			initials: "ア",
			summary: "調査メモや出典、読書の手がかりを共同で整理するプロフィールです。",
		},
	],
	realms: [
		{
			name: "アーカイブ・アトラス",
			initials: "アト",
			summary: "架空作品の世界観、登場人物、物語、思想的なテーマについて語り合います。",
		},
		{
			name: "集合知",
			initials: "集",
			summary: "集団が知識、判断、行動をどのように形づくるかを探ります。",
		},
		{
			name: "サイエンス・フィクション研究",
			initials: "S",
			summary: "さまざまな媒体や伝統にまたがるサイエンス・フィクション作品を精読します。",
		},
	],
	post: {
		title: "格子ネットワークは、なぜこの架空世界で最も特異な集合意識なのか？",
		body: "格子ネットワークは、個々の意識を足し合わせただけのものではありません。電磁的な媒体によって個人の能力の限界を越えながら、それぞれの違いも保っています。",
		mediaAlt: "光るネットワークの軌跡が交差する夜の都市",
	},
	collection: {
		title: "科学と物語が交わる場所",
		body: "何度でも読み返したい章、レビュー、世界設定のメモをまとめたコレクションです。",
		coverAlt: "青と琥珀色が交差する抽象的な本の表紙",
	},
} satisfies FeedFixtureLocalizedContent;
