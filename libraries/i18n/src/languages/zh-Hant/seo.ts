import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
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
	owners: {
		...feed.content.owners,
		publishing: zhHantTerminology.publishingCatalog.forms.entryLabel,
		reference: zhHantTerminology.referenceCatalog.forms.entryLabel,
		tag: "標籤",
		poll: "投票",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": zhHantTerminology.publishingWork.forms.label,
		"publishing:text_version": zhHantTerminology.textVersion.forms.label,
		"publishing:publication": zhHantTerminology.publication.forms.label,
		"music:recording": zhHantTerminology.musicRecording.forms.label,
		"music:release": zhHantTerminology.musicRelease.forms.label,
		"music:release_group": zhHantTerminology.musicReleaseGroup.forms.label,
		"program:program": zhHantTerminology.program.forms.label,
		"software:content": zhHantTerminology.softwareContent.forms.label,
		"software:version": zhHantTerminology.softwareVersion.forms.label,
		"software:release": zhHantTerminology.softwareRelease.forms.label,
		"grouping:grouping": zhHantTerminology.grouping.forms.label,
		"reference:concept": zhHantTerminology.referenceConcept.forms.label,
		"distribution:package": zhHantTerminology.distributionPackage.forms.label,
		"video:video": zhHantTerminology.video.forms.label,
		"audio:audio": zhHantTerminology.audio.forms.label,
		"zone:zone": zhHantTerminology.zone.forms.label,
		"realm:realm": zhHantTerminology.realm.forms.label,
		"post:chapter": zhHantTerminology.chapter.forms.label,
		"post:post": zhHantTerminology.post.forms.label,
		"post:excerpt": zhHantTerminology.post.forms.label,
		"post:review": zhHantTerminology.post.forms.label,
		"post:wiki": zhHantTerminology.post.forms.label,
		"post:picture": zhHantTerminology.post.forms.label,
		"tag:tag": "標籤",
		"poll:poll": "投票",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "首頁" },
};
