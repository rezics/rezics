export default {
	title: "Create",
	description: "Choose the type of content to create.",
	items: {
		book: "Book",
		game: "Game",
		media: "Media",
		entity: "Catalog entry",
		tag: "Tag",
		realm: "Realm",
		post: "Post",
		collection: "Collection",
		review: "Review",
		poll: "Poll",
	},
} satisfies typeof import("../zh-CN/create").default;
