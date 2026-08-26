import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = jaTerminology.audio;
const { forms: entityTerms } = jaTerminology.entity;
const { forms: metadataTerms } = jaTerminology.metadata;
const { forms: postTerms } = jaTerminology.post;
const { forms: realmTerms } = jaTerminology.realm;
const { forms: tagPathTerms } = jaTerminology.tagPath;
const { forms: videoTerms } = jaTerminology.video;
const { forms: zoneTerms } = jaTerminology.zone;

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
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		release: units.types.release,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "タグ",
		structure: tagPathTerms.label,
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `${zoneTerms.label}ページ`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "投票",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "ホーム" },
} satisfies typeof import("../zh-Hant/seo").default;
