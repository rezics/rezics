import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = koTerminology.audio;
const { forms: entityTerms } = koTerminology.entity;
const { forms: metadataTerms } = koTerminology.metadata;
const { forms: postTerms } = koTerminology.post;
const { forms: realmTerms } = koTerminology.realm;
const { forms: tagStructureTerms } = koTerminology.tagStructure;
const { forms: videoTerms } = koTerminology.video;
const { forms: zoneTerms } = koTerminology.zone;

export default {
	titles: {
		standard: insert("{{name}} | {{brand}}", { name: String, brand: String }),
		typed: insert("{{name}}({{kind}}) | {{brand}}", {
			name: String,
			kind: String,
			brand: String,
		}),
		profile: insert("{{name}}(@{{slug}}) | {{brand}}", {
			name: String,
			slug: String,
			brand: String,
		}),
		contextual: insert("{{name}} — {{context}} | {{brand}}", {
			name: String,
			context: String,
			brand: String,
		}),
		restricted: insert("제한된 콘텐츠 | {{brand}}", { brand: String }),
		unavailable: insert("페이지 정보를 사용할 수 없음 | {{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("{{brand}}에서 {{kind}} ‘{{name}}’ 페이지를 확인하세요.", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `이 페이지의 콘텐츠 등급은 검색 색인 ${metadataTerms.label} 제공 대상이 아닙니다.`,
		unavailable: "이 페이지의 공개 정보는 현재 검색 색인에 사용할 수 없습니다.",
	},
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "태그",
		structure: tagStructureTerms.label,
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `${zoneTerms.label} 페이지`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "투표",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "홈" },
} satisfies typeof import("../zh-Hant/seo").default;
