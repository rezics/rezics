import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "読者画面",
	journey: "現在の Journey",
	entrance: verbatimTerms.entranceNode.value,
	passageTitle: `${verbatimTerms.passageNode.value}：アーカイブ入口`,
	branchDescription: `読者は定義済みの分岐に到達します。選択した経路は、一般的な Progress とは別に ${verbatimTerms.journeyStep.value} として記録されます。`,
	choose: "選択する",
	choiceA: "選択肢 A · 閲覧室へ進む",
	choiceAOutcome: `${verbatimTerms.passageNode.value}：閲覧室`,
	choiceAStep: "選択肢 A → 閲覧室",
	choiceB: "選択肢 B · アーカイブを出る",
	choiceBOutcome: `${verbatimTerms.endingNode.value}：後で戻る`,
	choiceBStep: `選択肢 B → ${verbatimTerms.endingNode.value}`,
	authoring: "著者エディタ",
	validation: `有効な構造 · ${verbatimTerms.dag.value} 検証済み`,
	authoringSequence: `${verbatimTerms.gameContentStructure.value} の作成手順`,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: "開始点",
	choicesTwo: "選択肢：2",
	retirable: "廃止可能",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · ループ、スクリプト、変数、戦闘、実行時ルールはありません。`,
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
