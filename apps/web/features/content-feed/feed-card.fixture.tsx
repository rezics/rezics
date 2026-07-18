"use client";

import { useState, type ReactNode } from "react";
import {
	ArrowBigDownIcon,
	ArrowBigUpIcon,
	BookmarkIcon,
	EllipsisIcon,
	EyeOffIcon,
	FlagIcon,
	LibraryIcon,
	MessageCircleIcon,
	Share2Icon,
	StarIcon,
} from "lucide-react";

import {
	Badge,
	Button,
	ButtonGroup,
	ButtonGroupText,
	Menu,
	MenuContent,
	MenuGroup,
	MenuItem,
	MenuTrigger,
} from "@rezics/ui";
import {
	FeedCard,
	FeedCardActionBar,
	FeedCardBody,
	FeedCardContent,
	FeedCardHeader,
	FeedCardList,
	FeedCardMedia,
	FeedCardTarget,
	FeedCardTitle,
	type FeedActor,
	type FeedRealms,
} from "@/features/content-feed/feed-card";

const author = {
	name: "御坂網絡觀察者",
	href: "#author",
	avatarUrl: "https://i.pravatar.cc/96?img=47",
	initials: "御",
} satisfies FeedActor;

const reviewer = {
	name: "一方通行的右手",
	href: "#reviewer",
	avatarUrl: "https://i.pravatar.cc/96?img=12",
	initials: "一",
} satisfies FeedActor;

const curator = {
	name: "書庫編輯部",
	href: "#curator",
	avatarUrl: "https://i.pravatar.cc/96?img=32",
	initials: "書",
} satisfies FeedActor;

const realms = [
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

const reviewRealms = [realms[0], realms[2], realms[3]] satisfies FeedRealms;

const libraryRealms = [
	{
		id: "catalog",
		name: "輕小說庫",
		href: "#realm-catalog",
		avatarUrl: "https://i.pravatar.cc/64?img=28",
		initials: "庫",
	},
] satisfies FeedRealms;

const bookCover =
	"https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=320&q=85";
const postMedia =
	"https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1400&q=85";

function FeedFixtureCanvas({
	children,
	width = "wide",
}: {
	children: ReactNode;
	width?: "wide" | "mobile";
}) {
	return (
		<main className="min-h-screen bg-muted/40 p-3 sm:p-8">
			<div
				className={
					width === "mobile"
						? "mx-auto w-[390px] max-w-full overflow-hidden rounded-xl bg-card shadow-xs"
						: "mx-auto max-w-3xl overflow-hidden rounded-xl bg-card shadow-xs"
				}
			>
				{children}
			</div>
		</main>
	);
}

function FeedMenu() {
	return (
		<Menu>
			<MenuTrigger asChild>
				<Button
					aria-label="更多操作"
					className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
					pill
					size="icon-sm"
					variant="ghost"
				>
					<EllipsisIcon aria-hidden />
				</Button>
			</MenuTrigger>
			<MenuContent>
				<MenuGroup>
					<MenuItem value="not-interested">
						<EyeOffIcon aria-hidden />
						不感興趣
					</MenuItem>
					<MenuItem value="report">
						<FlagIcon aria-hidden />
						回報
					</MenuItem>
				</MenuGroup>
			</MenuContent>
		</Menu>
	);
}

type Vote = "up" | "down" | null;

function DemoActionBar({
	initialScore,
	comments,
	collectionLabel = "加入收藏",
}: {
	initialScore: number;
	comments: number;
	collectionLabel?: string;
}) {
	const [vote, setVote] = useState<Vote>(null);
	const [collected, setCollected] = useState(false);
	const [saved, setSaved] = useState(false);
	const [shared, setShared] = useState(false);
	const score = initialScore + (vote === "up" ? 1 : vote === "down" ? -1 : 0);

	return (
		<FeedCardActionBar>
			<ButtonGroup aria-label="評分">
				<Button
					aria-label="贊成"
					aria-pressed={vote === "up"}
					onClick={() => setVote((current) => (current === "up" ? null : "up"))}
					size="icon-sm"
					variant={vote === "up" ? "secondary" : "ghost"}
				>
					<ArrowBigUpIcon aria-hidden />
				</Button>
				<ButtonGroupText className="min-w-10 px-2 text-xs">{score}</ButtonGroupText>
				<Button
					aria-label="反對"
					aria-pressed={vote === "down"}
					onClick={() => setVote((current) => (current === "down" ? null : "down"))}
					size="icon-sm"
					variant={vote === "down" ? "secondary" : "ghost"}
				>
					<ArrowBigDownIcon aria-hidden />
				</Button>
			</ButtonGroup>
			<Button pill size="sm" variant="ghost">
				<MessageCircleIcon aria-hidden data-icon="inline-start" />
				{comments}
			</Button>
			<Button
				aria-pressed={collected}
				onClick={() => setCollected((current) => !current)}
				pill
				size="sm"
				variant={collected ? "secondary" : "ghost"}
			>
				<LibraryIcon aria-hidden data-icon="inline-start" />
				{collected ? "已收藏" : collectionLabel}
			</Button>
			<Button
				aria-pressed={shared}
				onClick={() => setShared(true)}
				pill
				size="sm"
				variant={shared ? "secondary" : "ghost"}
			>
				<Share2Icon aria-hidden data-icon="inline-start" />
				{shared ? "已複製連結" : "分享"}
			</Button>
			<Button
				aria-label={saved ? "取消儲存" : "儲存"}
				aria-pressed={saved}
				className="ms-auto"
				onClick={() => setSaved((current) => !current)}
				pill
				size="icon-sm"
				variant={saved ? "secondary" : "ghost"}
			>
				<BookmarkIcon aria-hidden fill={saved ? "currentColor" : "none"} />
			</Button>
		</FeedCardActionBar>
	);
}

function PostFeedCard() {
	return (
		<FeedCard aria-labelledby="post-feed-title">
			<FeedCardHeader
				actor={author}
				menu={<FeedMenu />}
				realms={realms}
				recommendation="因為你追蹤了魔法禁書目錄"
				timestamp="2 小時前"
			/>
			<FeedCardContent>
				<FeedCardTitle id="post-feed-title">
					為什麼御坂網絡是學園都市最特別的群體意識？
				</FeedCardTitle>
				<div className="flex flex-wrap gap-1.5">
					<Badge size="sm" variant="outline">
						世界觀
					</Badge>
					<Badge size="sm" variant="outline">
						人物分析
					</Badge>
					<Badge size="sm" variant="warning">
						輕微劇透
					</Badge>
				</div>
				<FeedCardBody>
					御坂網絡並非由個體思維的簡單疊加，而是以電磁場為媒介形成的群體意識。它既超越了個人能力的邊界，又保持著個體之間微妙的聯結與差異。
				</FeedCardBody>
				<FeedCardMedia alt="夜色中的城市與交錯光線" src={postMedia} />
			</FeedCardContent>
			<FeedCardTarget
				description="第 15 冊 · 鎌池和馬"
				href="#book"
				imageAlt="書籍封面"
				imageUrl={bookCover}
				label="關於這部作品"
				title="新約 魔法禁書目錄 15"
			/>
			<DemoActionBar comments={36} initialScore={128} />
		</FeedCard>
	);
}

function ReviewFeedCard() {
	return (
		<FeedCard aria-labelledby="review-feed-title">
			<FeedCardHeader
				actor={reviewer}
				menu={<FeedMenu />}
				realms={reviewRealms}
				timestamp="5 小時前"
			/>
			<FeedCardContent>
				<div className="flex flex-wrap items-center gap-2">
					<Badge size="sm" variant="success">
						Review
					</Badge>
					<div className="flex items-center gap-1 text-warning text-sm">
						<StarIcon aria-hidden className="size-4" fill="currentColor" />
						<span className="font-semibold">4.5</span>
					</div>
				</div>
				<FeedCardTitle id="review-feed-title">城市與意識之間的邊界</FeedCardTitle>
				<FeedCardBody>
					這卷從社會學與信息科學的視角，深刻解析御坂網絡如何在學園都市的結構中形成獨特定位，是理解系列世界觀不可或缺的一篇。
				</FeedCardBody>
			</FeedCardContent>
			<FeedCardTarget
				description="Book · 第 15 冊"
				href="#book"
				imageAlt="書籍封面"
				imageUrl={bookCover}
				label="Review 的作品"
				title="新約 魔法禁書目錄 15"
			/>
			<DemoActionBar comments={18} initialScore={96} />
		</FeedCard>
	);
}

function BookFeedCard() {
	return (
		<FeedCard aria-labelledby="book-feed-title">
			<FeedCardHeader
				actor={curator}
				menu={<FeedMenu />}
				realms={libraryRealms}
				timestamp="昨天"
			/>
			<FeedCardContent className="flex-row gap-4">
				<img
					alt="新約 魔法禁書目錄 15 的封面"
					className="aspect-[2/3] w-24 shrink-0 rounded-lg object-cover sm:w-28"
					src={bookCover}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex flex-wrap gap-1.5">
						<Badge size="sm" variant="info">
							Book
						</Badge>
						<Badge size="sm" variant="outline">
							繁體中文
						</Badge>
						<Badge size="sm" variant="outline">
							Main
						</Badge>
					</div>
					<FeedCardTitle id="book-feed-title">新約 魔法禁書目錄 15</FeedCardTitle>
					<FeedCardBody className="line-clamp-3">
						學園都市的科學與魔法交錯，新的危機與命運再次交鋒。上条當麻與伙伴們的戰鬥今日仍在延續。
					</FeedCardBody>
					<p className="text-muted-foreground text-xs">鎌池和馬 · 灰村清孝</p>
				</div>
			</FeedCardContent>
			<DemoActionBar collectionLabel="加入 Shelf" comments={0} initialScore={42} />
		</FeedCard>
	);
}

function CompactPostFeedCard() {
	return (
		<FeedCard aria-labelledby="compact-post-title">
			<FeedCardHeader actor={reviewer} menu={<FeedMenu />} realms={realms} timestamp="剛剛" />
			<FeedCardContent>
				<FeedCardTitle id="compact-post-title">
					動畫版第三季的敘事節奏比想像中更好
				</FeedCardTitle>
				<FeedCardBody className="line-clamp-2">
					重新整理幾個主要篇章之後，角色動機變得清晰很多，也讓第一次接觸系列的觀眾更容易理解。
				</FeedCardBody>
			</FeedCardContent>
			<DemoActionBar comments={7} initialScore={31} />
		</FeedCard>
	);
}

const fixtures = {
	"Grouped feed": (
		<FeedFixtureCanvas>
			<FeedCardList aria-label="Feed cards">
				<PostFeedCard />
				<BookFeedCard />
				<ReviewFeedCard />
				<CompactPostFeedCard />
			</FeedCardList>
		</FeedFixtureCanvas>
	),
	"Post · media and target book": (
		<FeedFixtureCanvas>
			<FeedCardList aria-label="Post feed card">
				<PostFeedCard />
			</FeedCardList>
		</FeedFixtureCanvas>
	),
	"Review · compact book context": (
		<FeedFixtureCanvas>
			<FeedCardList aria-label="Review feed card">
				<ReviewFeedCard />
			</FeedCardList>
		</FeedFixtureCanvas>
	),
	"Book · full content card": (
		<FeedFixtureCanvas>
			<FeedCardList aria-label="Book feed card">
				<BookFeedCard />
			</FeedCardList>
		</FeedFixtureCanvas>
	),
	"Mobile grouped feed": (
		<FeedFixtureCanvas width="mobile">
			<FeedCardList aria-label="Mobile feed cards">
				<ReviewFeedCard />
				<CompactPostFeedCard />
			</FeedCardList>
		</FeedFixtureCanvas>
	),
} satisfies Record<string, ReactNode>;

export default fixtures;
