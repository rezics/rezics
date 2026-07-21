import type { FeedActor, FeedRealms } from "./feed-card";

export const author = {
	name: "御坂網絡觀察者",
	href: "#author",
	avatarUrl: "https://i.pravatar.cc/96?img=47",
	initials: "御",
} satisfies FeedActor;

export const reviewer = {
	name: "一方通行的右手",
	href: "#reviewer",
	avatarUrl: "https://i.pravatar.cc/96?img=12",
	initials: "一",
} satisfies FeedActor;

export const curator = {
	name: "書庫編輯部",
	href: "#curator",
	avatarUrl: "https://i.pravatar.cc/96?img=32",
	initials: "書",
} satisfies FeedActor;

export const realms = [
	{
		id: "index",
		name: "魔法禁書目錄",
		href: "#realm-index",
		avatarUrl: "https://i.pravatar.cc/64?img=49",
		initials: "禁",
	},
	{
		id: "railgun",
		name: "科學超電磁砲",
		href: "#realm-railgun",
		avatarUrl: "https://i.pravatar.cc/64?img=45",
		initials: "超",
	},
	{
		id: "light-novel",
		name: "輕小說研究會",
		href: "#realm-light-novel",
		avatarUrl: "https://i.pravatar.cc/64?img=5",
		initials: "輕",
	},
	{
		id: "worldbuilding",
		name: "世界觀考察室",
		href: "#realm-worldbuilding",
		avatarUrl: "https://i.pravatar.cc/64?img=13",
		initials: "界",
	},
] satisfies FeedRealms;

export const reviewRealms = [realms[0], realms[2], realms[3]] satisfies FeedRealms;

export const libraryRealms = [
	{
		id: "catalog",
		name: "輕小說庫",
		href: "#realm-catalog",
		avatarUrl: "https://i.pravatar.cc/64?img=28",
		initials: "庫",
	},
] satisfies FeedRealms;

export const bookCover =
	"https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=320&q=85";

export const postMedia =
	"https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1400&q=85";
