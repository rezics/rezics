import { insert } from "native-i18n";

import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = zhHansTerminology.audio;
const { forms: entityTerms } = zhHansTerminology.entity;
const { forms: postTerms } = zhHansTerminology.post;
const { forms: realmTerms } = zhHansTerminology.realm;
const { forms: tagStructureTerms } = zhHansTerminology.tagStructure;
const { forms: videoTerms } = zhHansTerminology.video;
const { forms: zoneTerms } = zhHansTerminology.zone;

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
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		release: units.types.release,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "标签",
		structure: tagStructureTerms.label,
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `${zoneTerms.label}页面`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "投票",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "首页" },
} satisfies typeof import("../zh-Hant/seo").default;
