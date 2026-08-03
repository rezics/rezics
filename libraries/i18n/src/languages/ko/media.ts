import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} 또는 ${verbatimTerms.avif.value}`;

export default {
	choose: "이미지 선택, 삭제 또는 붙여넣기",
	hint: `${SupportedImageFormats}, 최대 10 ${verbatimTerms.mib.value}`,
	replace: "교체",
	remove: "제거",
	cancel: "취소",
	invalid: `10 ${verbatimTerms.mib.value} 이하의 ${SupportedImageFormats} 이미지를 선택하세요.`,
	current: "현재 언어 재정의",
	displayPreview: "표시 범위",
	editPresentation: "표시 범위 조정",
	upload: {
		preparing: "이미지 업로드 준비 중…",
		uploading: "이미지 업로드 중…",
		progress: insert("이미지 업로드 중… {{percentage}}%", { percentage: Number }),
		processing: "업로드가 완료되었습니다. 이미지 처리 중…",
	},
	localizationFallback: {
		notice: "모든 이미지 자산은 언어 대체 규칙을 각각 독립적으로 적용합니다.",
		title: "이미지 언어 대체 규칙",
		description: "아바타, 배너, 표지는 텍스트에 선택된 언어와 별개로 각각 결정됩니다.",
		viewerPreferences:
			"이미지는 각 사용자의 언어 선호 순서대로 검색합니다. 해당 언어에 그 이미지가 없으면 건너뛰고 다음 선호 언어를 계속 검색합니다.",
		defaultOrder:
			"사용자의 선호 언어에 이미지가 하나도 없으면 콘텐츠의 기본 현지화 순서대로 계속 검색합니다.",
		noImage: "어떤 언어에도 이미지가 설정되지 않았다면 현지화 이미지를 반환하지 않습니다.",
		textDifference:
			"텍스트는 규칙이 다릅니다. 하나의 완전한 언어 버전을 선택하므로 제목, 요약, 설명을 필드별로 다른 언어에서 대체하지 않습니다.",
		example:
			"예를 들어 사용자가 중국어, 영어 순으로 선호하고 중국어에는 텍스트와 배너만, 영어에는 아바타가 있다면 중국어 텍스트와 배너, 영어 아바타가 표시됩니다.",
		close: "이미지 언어 대체 규칙 닫기",
	},
	presentationEditor: {
		title: {
			avatar: "아바타 조정",
			banner: "배너 조정",
			cover: "커버 조정",
		},
		description: {
			avatar: "사각형 자르기 범위 안에서 이미지를 드래그하고 확대/축소하세요. 원형 아바타 미리보기는 원래 모서리를 제거하지 않습니다.",
			banner: "고정 4:1 자르기 범위 안에서 이미지를 드래그하고 확대/축소하세요. 새 배너는 좌상단에서 시작합니다.",
			cover: "기본적으로 전체 이미지를 유지하거나, 구성이 더 중요할 때 고정 3:4 크롭으로 전환하세요.",
		},
		close: "이미지 조정 닫기",
		loading: "원본 이미지 로딩 중…",
		loadFailed: "원본 이미지 또는 그 표시를 로드할 수 없습니다.",
		cropArea:
			"이미지 자르기 범위. 드래그하여 위치를 변경하고, 마우스 휠로 확대/축소하거나, 화살표 키로 이동할 수 있습니다.",
		zoom: "확대/축소",
		zoomIn: "확대",
		zoomOut: "축소",
		reset: "초기화",
		avatarPreview: "원형 미리보기",
		bannerPreview: "배너 미리보기",
		coverPreview: "전체 커버 미리보기",
		coverMode: {
			label: "커버 표시 모드",
			contain: "전체 이미지 표시",
			crop: "3:4로 크롭",
			containDescription:
				"전체 이미지가 계속 표시됩니다. 프레임의 비율이 다를 경우 흐림 배경을 사용합니다.",
			cropDescription: "선택된 3:4 범위만 전달되고 표시됩니다.",
		},
		cancel: "취소",
		save: "표시 범위 저장",
		saveFailed: "표시 범위를 저장할 수 없습니다. 다시 시도하세요.",
	},
	avatarPicker: {
		setup: "아바타 설정",
		edit: "아바타 편집",
		dialogTitle: "아바타 선택",
		dialogDescription: "이미지를 업로드하거나 아이콘 또는 이모지를 선택하세요.",
		close: "아바타 선택기 닫기",
		source: "아바타 출처",
		useInherited: "상속된 아바타 사용",
		recent: "최근 사용",
		typeLabel: "아바타 유형",
		tabs: { image: "이미지", icon: "아이콘", emoji: "이모지" },
		preview: "아바타 미리보기",
		icon: {
			search: "아이콘 검색",
			featured: "일반 아이콘",
			style: "아이콘 스타일",
			styles: { fas: "단색", fab: "브랜드" },
			loading: "아이콘 검색 중…",
			empty: "일치하는 아이콘이 없습니다.",
			failed: "지금 아이콘을 검색할 수 없습니다. 나중에 다시 시도하세요.",
			select: insert("아이콘 선택: {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value}가 구성되지 않아 아이콘 미리보기를 표시할 수 없습니다.`,
		},
		emoji: {
			search: "이모지 검색",
			skinTone: "피부 톤 변경",
			loading: "이모지 로딩 중…",
			empty: "일치하는 이모지가 없습니다.",
		},
	},
	bannerPreview: {
		description: "전달된 배너는 저장된 4:1 범위를 사용합니다.",
		showOriginal: "전체 이미지 보기",
		hideOriginal: "전체 이미지 숨기기",
		original: "전체 이미지",
	},
	roles: {
		avatar: {
			title: "아바타",
			inherit: "로컬라이제이션 순서에서 첫 번째 사용 가능한 아바타 사용",
			failed: "아바타를 업로드할 수 없습니다. 다시 시도하세요.",
		},
		banner: {
			title: "배너",
			inherit: "로컬라이제이션 순서에서 첫 번째 사용 가능한 배너 사용",
			failed: "배너를 업로드할 수 없습니다. 다시 시도하세요.",
		},
		cover: {
			title: "표지",
			inherit: "현지화 순서에서 사용 가능한 첫 번째 표지 사용",
			failed: "표지를 업로드할 수 없습니다. 다시 시도하세요.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
