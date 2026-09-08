import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = jaTerminology.metadata;

export default {
	titles: {
		standard: insert("{{name}}｜{{brand}}", { name: String, brand: String }),
		typed: insert("{{name}}（{{kind}}）｜{{brand}}", {
			name: String,
			kind: String,
			brand: String,
		}),
		profile: insert("{{name}}（@{{slug}}）｜{{brand}}", {
			name: String,
			slug: String,
			brand: String,
		}),
		contextual: insert("{{name}} — {{context}}｜{{brand}}", {
			name: String,
			context: String,
			brand: String,
		}),
		restricted: insert("制限付きコンテンツ｜{{brand}}", { brand: String }),
		unavailable: insert("ページ情報を利用できません｜{{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("{{brand}}で{{kind}}「{{name}}」を見る。", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `このページのコンテンツ区分は、検索インデックス用${metadataTerms.label}の対象外です。`,
		unavailable: "このページの公開情報は現在、検索インデックスに利用できません。",
	},
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "ホーム" },
} satisfies typeof import("../zh-Hant/seo").default;
