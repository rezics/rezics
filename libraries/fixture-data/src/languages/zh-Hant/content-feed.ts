import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	publishers: [
		{
			name: "海豚號讀書會",
			initials: "海",
			summary: "共同閱讀科幻作品、評論與讀書筆記的社群。",
		},
		{
			name: "森玲奈",
			initials: "森",
			summary: "書寫網絡意識，以及虛構世界中的社會關係。",
		},
		{
			name: "檔案訊號",
			initials: "檔",
			summary: "協作整理研究札記、引用來源與閱讀線索。",
		},
	],
	realms: [
		{
			name: "魔法禁書目錄",
			initials: "禁",
			summary: "討論作品世界觀、角色、情節與思想主題。",
		},
		{
			name: "群體智慧",
			initials: "群",
			summary: "探索群體如何共同形成知識、判斷與行動。",
		},
		{
			name: "科幻研究",
			initials: "科",
			summary: "細讀不同媒介與傳統中的科幻作品。",
		},
	],
	post: {
		title: "為什麼御坂網絡是學園都市最特別的群體意識？",
		body: "御坂網絡並非由個體思維的簡單疊加，而是以電磁場為媒介形成的群體意識。它既超越個人能力的邊界，也保留個體之間的差異。",
		mediaAlt: "夜色城市上交錯延伸的發光網絡",
	},
	collection: {
		title: "科學與魔法的交會點",
		body: "整理系列中值得反覆閱讀的篇章、評論與世界觀資料。",
		coverAlt: "藍色與琥珀色交錯的抽象書籍封面",
	},
} satisfies FeedFixtureLocalizedContent;
