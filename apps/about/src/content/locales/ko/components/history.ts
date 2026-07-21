import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "버전",
	publishedVersions: "공개 버전",
	fieldHistory: "필드 이력",
	diff: "필드 차이",
	locked: "이 필드는 현재 편집 범위에서 잠겨 있습니다",
	bookTitle: verbatimTerms.bookTitleField.value,
	postBlock: verbatimTerms.postBlockField.value,
	zoneConfig: verbatimTerms.zoneConfigField.value,
	publishedVersionC: "공개 버전 C",
	publishedVersionB: "공개 버전 B",
	publishedVersionA: "공개 버전 A",
	current: "현재",
	previous: "이전",
	initial: "최초",
	previousTitle: "이전 제목",
	currentTitle: "현재 공개 제목",
	postBlockHistory: `${koTerminology.post.forms.label} 블록 이력`,
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / 공개 B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / 공개 C`,
	zoneConfigurationHistory: `${koTerminology.zone.forms.label} 설정 이력`,
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / 공개 A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / 공개 B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
