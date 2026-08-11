import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = zhHantTerminology.audio;
const { forms: entityTerms } = zhHantTerminology.entity;
const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: tagStructureTerms } = zhHantTerminology.tagStructure;
const { forms: videoTerms } = zhHantTerminology.video;
const { forms: zoneTerms } = zhHantTerminology.zone;

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
		restricted: insert("受限內容｜{{brand}}", { brand: String }),
		unavailable: insert("頁面資訊暫不可用｜{{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("在 {{brand}} 查看「{{name}}」的{{kind}}頁面。", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: "此頁面的內容分級不提供搜尋引擎索引資訊。",
		unavailable: "此頁面的公開資訊目前無法用於搜尋引擎索引。",
	},
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "標籤",
		structure: tagStructureTerms.label,
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `${zoneTerms.label}頁面`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "投票",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "首頁" },
};
