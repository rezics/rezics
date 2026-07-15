export default {
	reply: {
		title: "New reply on REZICS",
		body: "Someone replied to a conversation you joined.",
	},
	follow: { title: "New follower on REZICS", body: "Someone started following you." },
	direct_message: {
		title: "New message on REZICS",
		body: "You received a new direct message.",
	},
	moderation: {
		title: "REZICS moderation update",
		body: "The moderation status of your content changed.",
	},
	realm: {
		title: "REZICS Realm update",
		body: "Something changed in a Realm you belong to.",
	},
	system: {
		title: "REZICS system notification",
		body: "You received a system notification.",
	},
} satisfies typeof import("../zh-CN/notifications").default;
