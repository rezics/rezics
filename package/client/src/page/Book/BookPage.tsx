import React, { useEffect, useRef } from "react";
import {
	Box,
	Divider,
	Grid,
	Paper,
	Stack,
	Tab,
	Typography,
} from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useLocation } from "wouter";
import { BookTagView } from "@/component/Book/BookTagPreview.tsx";
import { BookReviews } from "@/component/Book/BookReviewsPreview.tsx";
import { ShortBookReviews } from "@/component/Book/ShortBookReviewsPreview.tsx";
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";

import { ChapterList } from "@component/Book/ChapterList.tsx";
import { ArrowForwardIcon } from "@component/Common/ArrowForwardIcon.tsx";
import { BookHero } from "@component/Book/BookHero.tsx";
import { BookDescription } from "@/component/Book/BookDescription.tsx";
import { AuthorInfo } from "@/component/Book/AuthorInfo.tsx";
import { QuoteExcerptPreview } from "@/component/Book/QuoteExcerptPreview.tsx";
import { ReadlistByBookPreview } from "@/component/Book/ReadlistByBookPreview.tsx";

import { routeStore } from "@/global/routeStore.ts";
import { startThrottledScroll } from "@/util/ScrollUtil.ts";
import { Book } from "contract";
import useSWR from "swr";
import { useBookPageStore } from "@/global/page/bookPageStore.ts";

export namespace BookPage {
	type Tab = "0" | "1" | "2";

	export type Show = {
		ref?: React.Ref<unknown> | undefined;
		data: any;
		activeTab: string;
		onTabChange?:
			| ((event: React.SyntheticEvent | null, newValue: Tab) => void)
			| undefined;
	};

	export const Show: React.FC<Show> = ({
		ref,
		data,
		activeTab,
		onTabChange,
	}) => {
		return (
			<Box id="book-detail" ref={ref}>
				{/* Book Overview */}
				<BookHero.Container data={data} />

				{/* Main Content */}
				<Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
					<Grid container spacing={4}>
						{/* Main Content */}
						<Grid size={{ xs: 12, lg: 9 }}>
							<TabContext value={activeTab}>
								<TabList onChange={onTabChange}>
									<Tab label="基本信息" value="0" />
									<Tab label="书评" value="1" />
									<Tab label="目录" value="2" />
								</TabList>

								<TabPanel value="0">
									<Stack spacing={4}>
										{/* ANCHOR Description */}
										<BookDescription.Container
											description={data?.description ||
												""}
											bookId={data?.id || ""}
										/>
										<Divider />

										{/* ANCHOR Tags */}
										{/* <BookTagView.Container tagObjects={data?.book.tags || []} /> */}
										<BookTagView.Container
											bookId={data?.id || "1"}
										/>
										<Divider />

										{/* ANCHOR Author Info */}
										<AuthorInfo.Container
											author={data?.author || {}}
										/>
										<Divider />

										{/* ANCHOR 最新章节 */}

										{/* ANCHOR Quote Excerpt Preview */}
										<div>
											<ArrowForwardIcon.Container
												size={16}
												to={`/quote/book/${data?.id}`}
											>
												<AccentBarWithText.Container text="原文摘录" />
											</ArrowForwardIcon.Container>
										</div>
										<QuoteExcerptPreview.Container
											id={data?.id || ""}
										/>
										<Divider />

										{/* ANCHOR Short Reviews */}
										<Box>
											<div>
												<ArrowForwardIcon.Container
													size={16}
													to={`/review/short/book/${data?.id}`}
												>
													<AccentBarWithText.Container text="短评" />
												</ArrowForwardIcon.Container>
											</div>
											<ShortBookReviews
												bookId={data?.id || ""}
											/>
										</Box>
									</Stack>
								</TabPanel>

								<TabPanel value="1">
									<Stack spacing={4}>
										{/* ANCHOR Book Reviews */}
										<BookReviews
											bookId={data?.id || ""}
											title={data?.title || ""}
										/>

										{/* ANCHOR Book Lists */}
										<ReadlistByBookPreview
											bookId={data?.id || ""}
											title={data?.title || ""}
										/>
									</Stack>
								</TabPanel>

								<TabPanel value="2">
									<Stack spacing={4}>
										{/* ANCHOR Chapter List */}
										<ChapterList id={data?.id || "0"} />
									</Stack>
								</TabPanel>
							</TabContext>
						</Grid>

						{/* ANCHOR Sidebar */}
						<Grid size={{ xs: 12, lg: 3 }}>
							<Paper className="p-3 mt-4">
								<Divider className="my-4" />

								{/* Book Info */}
								<Box>
									<Typography
										variant="h6"
										className="font-bold mb-4"
									>
										书籍信息
									</Typography>
									<Stack spacing={1}>
										<Typography variant="body2">
											书名：{data?.title}
										</Typography>
										<Typography variant="body2">
											作者：{data?.author?.name}
										</Typography>
										<Typography variant="body2">
											出版社：{data?.publisher}
										</Typography>
										<Typography variant="body2">
											出版日期：{data?.publishDate}
										</Typography>
										<Typography variant="body2">
											ISBN：{data?.isbn}
										</Typography>
									</Stack>
								</Box>
							</Paper>
						</Grid>
					</Grid>
				</Box>
			</Box>
		);
	};

	export type Container = {
		bookId: string;
	};

	const scroll = async (distance: number, count = 0) => {
		// After adjusting the page structure, the function worked much better.
		if (count > 1000) {
			return;
		}

		const before = globalThis.pageYOffset;

		globalThis.scrollTo({
			top: distance,
		});

		if (Math.abs(globalThis.pageYOffset - before) > 10) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return scroll(distance, count + 1);
		}
	};

	export const Container: React.FC<Container> = ({ bookId }) => {
		const [location] = useLocation();

		const getInitialTab = (): Tab => {
			const routeData = routeStore
				.getState()
				.getRouteData(String(location));
			return (routeData?.tab as Tab) || "0";
		};
		const [activeTab, setActiveTab] = React.useState<Tab>(getInitialTab);

		// ANCHOR Data Fetching
		const book = useBookPageStore((s) => s.books[bookId]);
		const createBookInput = {
			operation: "book.read",
			parameter: { id: bookId },
			select: {
				id: true,
				name: true,
				authors: [{ id: true, name: true }],
				cover: true,
				description: true,
				length: true,
			},
		} satisfies Book.Input.Read;

		const { data, isLoading, error } = useSWR<
			Book.Output.Read<typeof createBookInput.select>,
			Error,
			typeof createBookInput
		>(createBookInput);

		useEffect(() => {
			useBookPageStore.getState().updateBook(bookId, { ...data });
		}, [data, isLoading]);

		const tabRef = useRef<Tab>(getInitialTab());
		const handleTabChange = (
			_: React.SyntheticEvent | null,
			newValue: Tab,
		) => {
			console.log("handleTabChange", newValue);
			tabRef.current = newValue;
			setActiveTab(newValue);
		};

		let stopThrottledScroll: any = null;
		useEffect(() => {
			const timer = globalThis.setTimeout(() => {
				stopThrottledScroll = startThrottledScroll((_y) => {
					// console.log("当前滚动位置：", y);
					// console.log("location", bookId);
					routeStore.getState().setRouteData(String(location), {
						scrollY: globalThis.pageYOffset,
						// scrollY: window.scrollY,
						tab: tabRef.current,
					});
				}, 200); // 150ms 节流
			}, 500); // 500ms 后开始节流
			return () => {
				clearTimeout(timer);
				stopThrottledScroll?.();

				const prev =
					routeStore.getState().getRouteData(String(location)) || {};
				routeStore.getState().setRouteData(String(location), {
					...prev,
					tab: tabRef.current, // Override tab, scrollY keep unchanged
				});
				console.log(
					"routeStoreData",
					routeStore.getState().getRouteData(String(location)),
				);
			};
		}, [location]);

		useEffect(() => {
			// NOTE 這裏的邏輯還是有問題，雖然理論上只有回退的時候才會觸發滾動，但是我還是不確定會不會有bug
			const routeData = routeStore
				.getState()
				.getRouteData(String(location));
			if (routeData?.scrollY) {
				console.log("scroll to", routeData.scrollY);
				scroll(routeData.scrollY);
			}
		}, [location]);

		if (isLoading) {
			return <div>Loading...</div>;
		}

		if (error) {
			return <div>Oh no... {String(error)}</div>;
		}

		if (!book?.id) {
			return null; // 或者 return <div>No data</div>;
		}
		// if (!data.isbn) {
		//     return null; // 或者 return <div>No data</div>;
		// }

		return (
			<Show
				data={book}
				activeTab={activeTab}
				onTabChange={handleTabChange}
			/>
		);
	};
}
