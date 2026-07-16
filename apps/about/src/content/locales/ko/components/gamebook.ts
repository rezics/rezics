const content = {
	reader: "독자 화면",
	journey: "현재 Journey",
	entrance: "Entrance",
	passageTitle: "Passage: 아카이브 입구",
	branchDescription:
		"독자는 정의된 분기에 도달합니다. 선택한 경로는 일반 Progress와 별도로 JourneyStep에 기록됩니다.",
	choose: "선택하기",
	choiceA: "선택지 A · 열람실로 이동",
	choiceAOutcome: "Passage: 열람실",
	choiceAStep: "선택지 A → 열람실",
	choiceB: "선택지 B · 아카이브 나가기",
	choiceBOutcome: "Ending: 나중에 돌아오기",
	choiceBStep: "선택지 B → Ending",
	authoring: "저작 편집기",
	validation: "유효한 구조 · DAG 검사 통과",
	authoringSequence: "GameContentStructure 작성 순서",
	passage: "Passage",
	ending: "Ending",
	entry: "시작점",
	choicesTwo: "선택지: 2",
	retirable: "폐기 가능",
	constraints:
		"Entrance → Passage → Ending · 반복, 스크립트, 변수, 전투, 런타임 규칙은 없습니다.",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
