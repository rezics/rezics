import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
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
	owners: {
		...feed.content.owners,
		publishing: zhHansTerminology.publishingCatalog.forms.entryLabel,
		reference: zhHansTerminology.referenceCatalog.forms.entryLabel,
		tag: "标签",
		poll: "投票",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": zhHansTerminology.publishingWork.forms.label,
		"publishing:text_version": zhHansTerminology.textVersion.forms.label,
		"publishing:publication": zhHansTerminology.publication.forms.label,
		"music:recording": zhHansTerminology.musicRecording.forms.label,
		"music:release": zhHansTerminology.musicRelease.forms.label,
		"music:release_group": zhHansTerminology.musicReleaseGroup.forms.label,
		"program:program": zhHansTerminology.program.forms.label,
		"software:content": zhHansTerminology.softwareContent.forms.label,
		"software:version": zhHansTerminology.softwareVersion.forms.label,
		"software:release": zhHansTerminology.softwareRelease.forms.label,
		"grouping:grouping": zhHansTerminology.grouping.forms.label,
		"reference:concept": zhHansTerminology.referenceConcept.forms.label,
		"distribution:package": zhHansTerminology.distributionPackage.forms.label,
		"video:video": zhHansTerminology.video.forms.label,
		"audio:audio": zhHansTerminology.audio.forms.label,
		"zone:zone": zhHansTerminology.zone.forms.label,
		"realm:realm": zhHansTerminology.realm.forms.label,
		"post:chapter": zhHansTerminology.chapter.forms.label,
		"post:post": zhHansTerminology.post.forms.label,
		"post:excerpt": zhHansTerminology.post.forms.label,
		"post:review": zhHansTerminology.post.forms.label,
		"post:wiki": zhHansTerminology.post.forms.label,
		"post:picture": zhHansTerminology.post.forms.label,
		"tag:tag": "标签",
		"poll:poll": "投票",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "首页" },
} satisfies typeof import("../zh-Hant/seo").default;
