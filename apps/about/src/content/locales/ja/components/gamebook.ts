const content = {
	reader: "読者画面",
	journey: "現在の Journey",
	entrance: "Entrance",
	passageTitle: "Passage：アーカイブ入口",
	branchDescription:
		"読者は定義済みの分岐に到達します。選択した経路は、一般的な Progress とは別に JourneyStep として記録されます。",
	choose: "選択する",
	choiceA: "選択肢 A · 閲覧室へ進む",
	choiceAOutcome: "Passage：閲覧室",
	choiceAStep: "選択肢 A → 閲覧室",
	choiceB: "選択肢 B · アーカイブを出る",
	choiceBOutcome: "Ending：後で戻る",
	choiceBStep: "選択肢 B → Ending",
	authoring: "著者エディタ",
	validation: "有効な構造 · DAG 検証済み",
	authoringSequence: "GameContentStructure の作成手順",
	passage: "Passage",
	ending: "Ending",
	entry: "開始点",
	choicesTwo: "選択肢：2",
	retirable: "廃止可能",
	constraints:
		"Entrance → Passage → Ending · ループ、スクリプト、変数、戦闘、実行時ルールはありません。",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
