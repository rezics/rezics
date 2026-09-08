import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = koTerminology.metadata;

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
	owners: {
		...feed.content.owners,
		publishing: koTerminology.publishingCatalog.forms.entryLabel,
		reference: koTerminology.referenceCatalog.forms.entryLabel,
		tag: "태그",
		poll: "투표",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": koTerminology.publishingWork.forms.label,
		"publishing:text_version": koTerminology.textVersion.forms.label,
		"publishing:publication": koTerminology.publication.forms.label,
		"music:recording": koTerminology.musicRecording.forms.label,
		"music:release": koTerminology.musicRelease.forms.label,
		"music:release_group": koTerminology.musicReleaseGroup.forms.label,
		"program:program": koTerminology.program.forms.label,
		"software:content": koTerminology.softwareContent.forms.label,
		"software:version": koTerminology.softwareVersion.forms.label,
		"software:release": koTerminology.softwareRelease.forms.label,
		"grouping:grouping": koTerminology.grouping.forms.label,
		"reference:concept": koTerminology.referenceConcept.forms.label,
		"distribution:package": koTerminology.distributionPackage.forms.label,
		"video:video": koTerminology.video.forms.label,
		"audio:audio": koTerminology.audio.forms.label,
		"zone:zone": koTerminology.zone.forms.label,
		"realm:realm": koTerminology.realm.forms.label,
		"post:chapter": koTerminology.chapter.forms.label,
		"post:post": koTerminology.post.forms.label,
		"post:excerpt": koTerminology.post.forms.label,
		"post:review": koTerminology.post.forms.label,
		"post:wiki": koTerminology.post.forms.label,
		"post:picture": koTerminology.post.forms.label,
		"tag:tag": "태그",
		"poll:poll": "투표",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "홈" },
} satisfies typeof import("../zh-Hant/seo").default;
