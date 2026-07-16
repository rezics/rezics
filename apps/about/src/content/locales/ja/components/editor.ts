const content = {
	document: "文書",
	blocks: "ブロック",
	history: "History",
	draftBoundary: "下書きの境界",
	contentTitle: "コンテンツタイトル",
	paragraphBlock: "段落ブロック",
	description:
		"構造化コンテンツはここで編集可能な状態を保ちます。公開された変更が History に入るのは、公開境界を越えたときだけです。",
} satisfies typeof import("../../en/components/editor").default;

export default content;
