import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";

const content = {
	breadcrumbsHome: "홈",
	breadcrumbsProducts: "제품",
	names: {
		catalog: "카탈로그",
		book: "도서",
		gamebook: "게임북",
		media: "미디어",
		software: "소프트웨어",
		series: "시리즈",
		release: "릴리스",
		post: koTerminology.post.forms.label,
		wiki: "위키",
		picture: "이미지",
		review: "리뷰",
		collection: "컬렉션",
		library: "라이브러리",
		realm: koTerminology.realm.forms.label,
		zone: koTerminology.zone.forms.label,
		comment: "댓글",
		score: "평점",
		"content-structure": "콘텐츠 구조",
		history: "기록",
		editor: "편집기",
		feed: "피드",
		tag: "태그",
		progress: "진행",
		entity: "엔터티",
		"api-oauth": `${verbatimTerms.api.value} 및 ${verbatimTerms.oauth.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: "도서 + 게임 콘텐츠 구조 → 게임북",
		wiki: `${koTerminology.post.forms.label}（${verbatimTerms.kindWiki.value}）→ 위키`,
		picture: `${koTerminology.post.forms.label}（${verbatimTerms.kindPicture.value}）→ 이미지`,
		review: `${koTerminology.post.forms.label}（${verbatimTerms.kindReview.value}）→ 리뷰`,
		library: `컬렉션（${verbatimTerms.collectionArray.value}）→ 라이브러리`,
	},
	capabilityModeLabels: {
		ContentStructure: "콘텐츠 구조",
		GameContentStructure: "게임 콘텐츠 구조",
		Entity: "엔터티",
		CreditAttribution: "기여 귀속",
		SubjectAssociation: "주제 연결",
	},
	scenarios: "구체적인 사용 장면",
	workflow: "핵심 작업 흐름",
	capabilities: "사용하는 공유 기능",
	boundaries: "제품 경계",
	faq: "자주 묻는 질문",
	statusLabel: "상태",
	classificationLabel: "유형",
	consumers: "이 기능을 사용하는 제품",
	sectionEyebrows: {
		use: "사용법",
		workflow: "작업 흐름",
		platform: "플랫폼",
		scope: "범위",
		faq: "자주 묻는 질문",
		next: "다음 항목",
	},
} satisfies typeof import("../../en/products/common").default;

export default content;
