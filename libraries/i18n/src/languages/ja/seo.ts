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
	owners: {
		...feed.content.owners,
		publishing: jaTerminology.publishingCatalog.forms.entryLabel,
		reference: jaTerminology.referenceCatalog.forms.entryLabel,
		tag: "タグ",
		poll: "投票",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": jaTerminology.publishingWork.forms.label,
		"publishing:text_version": jaTerminology.textVersion.forms.label,
		"publishing:publication": jaTerminology.publication.forms.label,
		"music:recording": jaTerminology.musicRecording.forms.label,
		"music:release": jaTerminology.musicRelease.forms.label,
		"music:release_group": jaTerminology.musicReleaseGroup.forms.label,
		"program:program": jaTerminology.program.forms.label,
		"software:content": jaTerminology.softwareContent.forms.label,
		"software:version": jaTerminology.softwareVersion.forms.label,
		"software:release": jaTerminology.softwareRelease.forms.label,
		"grouping:grouping": jaTerminology.grouping.forms.label,
		"reference:concept": jaTerminology.referenceConcept.forms.label,
		"distribution:package": jaTerminology.distributionPackage.forms.label,
		"video:video": jaTerminology.video.forms.label,
		"audio:audio": jaTerminology.audio.forms.label,
		"zone:zone": jaTerminology.zone.forms.label,
		"realm:realm": jaTerminology.realm.forms.label,
		"post:chapter": jaTerminology.chapter.forms.label,
		"post:post": jaTerminology.post.forms.label,
		"post:excerpt": jaTerminology.post.forms.label,
		"post:review": jaTerminology.post.forms.label,
		"post:wiki": jaTerminology.post.forms.label,
		"post:picture": jaTerminology.post.forms.label,
		"tag:tag": "タグ",
		"poll:poll": "投票",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "ホーム" },
} satisfies typeof import("../zh-Hant/seo").default;
