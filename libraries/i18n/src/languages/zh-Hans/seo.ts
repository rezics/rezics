import { insert } from "native-i18n";

import ui from "./ui";
import feed from "./feed";

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
		contextual: insert("{{name}}－{{context}}｜{{brand}}", {
			name: String,
			context: String,
			brand: String,
		}),
		restricted: insert("受限内容｜{{brand}}", { brand: String }),
		unavailable: insert("页面信息暂不可用｜{{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("在 {{brand}} 查看“{{name}}”的{{kind}}页面。", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: "此页面的内容分级不提供搜索引擎索引信息。",
		unavailable: "此页面的公开信息目前无法用于搜索引擎索引。",
	},
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "首页" },
} satisfies typeof import("../zh-Hant/seo").default;
