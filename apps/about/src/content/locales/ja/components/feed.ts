import { jaTerminology } from "@rezics/i18n/terminology/ja";

const content = {
	consumers: "この機能を使うプロダクト",
	zone: jaTerminology.zone.forms.label,
	realm: jaTerminology.realm.forms.label,
	home: "Home",
	zoneFeed: `${jaTerminology.zone.forms.label}のフィード`,
	realmFeed: `${jaTerminology.realm.forms.label}のフィード`,
	homeFeed: "ホームフィード",
	postCard: `${jaTerminology.post.forms.label}カード`,
	bookCard: "Book カード",
	commentCard: "Comment カード",
	kindAware: "種別対応",
	catalog: "カタログ",
	discussion: "ディスカッション",
	consumerConfiguration: "利用側の設定",
	query: "クエリ",
	consumerScope: "利用側のスコープ",
	card: "カード",
	perFeature: "機能ごと",
	order: "並び順",
	feedOrder: "Feed の並び順",
} satisfies typeof import("../../en/components/feed").default;

export default content;
