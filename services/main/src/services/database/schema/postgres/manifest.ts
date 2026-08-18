export const PostgreSqlSchemaFileNames = ["book-chapter-progress.sql"] as const;

export const PostgreSqlSchemaFunctionNames = [
	"apply_book_chapter_delta",
	"book_chapter_node_scope",
	"maintain_book_chapter_from_node",
	"maintain_book_chapter_from_post",
	"maintain_book_chapter_from_progress",
	"maintain_book_chapter_from_structure",
	"maintain_book_chapter_from_unit",
] as const;

export const PostgreSqlSchemaTriggers = [
	{ table: "content_structure_node", name: "book_chapter_node_stat_maintain" },
	{ table: "post", name: "book_chapter_post_stat_maintain" },
	{
		table: "content_structure_node_progress",
		name: "book_chapter_progress_stat_maintain",
	},
	{ table: "content_structure", name: "book_chapter_structure_stat_maintain" },
	{ table: "unit", name: "book_chapter_unit_stat_maintain" },
] as const;
