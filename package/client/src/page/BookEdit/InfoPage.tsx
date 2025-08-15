import { BookDescriptionEdit } from "@/component/Book/BookDescription.tsx";
import React from "react";
import { useTranslation } from "react-i18next";
import { apiPost } from "@/api/swr.ts";
import useSWR from "swr";
import { AccentBarWithText } from "@/component/Common/AccentBar.tsx";
// import Paper from "@mui/material/Paper";

interface BookEditMainPage {
	bookId: string;
}

export const BookEditMainPage: React.FC<BookEditMainPage> = ({ bookId }) => {
	const { t } = useTranslation();
	const createBookInfoInput = {
		operation: "book.read",
		parameter: {
			bookId: bookId || "",
		},
	};
	const { data, isLoading, error } = useSWR(createBookInfoInput, apiPost);
	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {String(error)}</div>;
	if (!data) return <div>No data</div>;
	return (
		<div className="mt-10 mx-auto w-11/12">
			<div>
				<div className="flex mb-4">
					<AccentBarWithText.Show text={t("book.description")} />
				</div>
				<BookDescriptionEdit.Container
					description={data?.description ?? ""}
					editOpen={false}
					setEditOpen={() => {}}
				/>
			</div>
			<div>
				<div className="flex mb-4">
					<AccentBarWithText.Show text="tags" />
				</div>
			</div>
			<div>
				<div className="flex mb-4">
					<AccentBarWithText.Show text="章節" />
				</div>
				<blockquote className="p-4 my-4 border-s-4 border-gray-300 bg-gray-50 dark:border-gray-500 dark:bg-gray-800">
					<p className="leading-relaxed text-gray-600 dark:text-white">
						章節的編輯請從側邊欄，右擊支持新增，頂部按鈕開啓后支持拖拽，重命名請點擊進入具體章節
					</p>
				</blockquote>
			</div>
		</div>
	);
};
