import { AccentBarContainer } from "@component/Common/AccentBar.tsx";
import { CollapsibleText } from "@component/Common/CollapsibleText.tsx";
import React, { useRef } from "react";
import { useParams } from "wouter";
// import { ReplyComponents } from "@component/Form/ReplyComponents";
import { apiPost } from "@/api/swr.ts";
import { TreeReplyComponents } from "@component/Form/TreeReplyComponents.tsx";
import { Add, ChatBubbleOutline, Comment, FavoriteBorder } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

export const ReadListPage: React.FC = () => {
    const { t } = useTranslation();
    const { readlistId } = useParams<{ readlistId: string }>();
    const createReadlistReadInput = {
        operation: "readlist.read",
        parameter: {
            readlistId: readlistId || "",
        },
    };
    const { data, isLoading, error } = useSWR(createReadlistReadInput, apiPost);

    const commentRef = useRef<HTMLDivElement>(null);

    const handleGoToComments = () => {
        // @ts-ignore: scrollIntoView is not defined in the type declaration
        commentRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const handleReply = () => {
        console.log("reply");
    };

    if (isLoading) {
        return <div className="text-center py-10">加载中...</div>;
    }

    const bookList = data;
    if (!bookList?.id) {
        return <div className="text-center py-10 text-red-500">未找到书单</div>;
    }

    return (
        <div
            className="w-full max-w-4xl mt-[60px] mx-auto"
            data-testid="booklist-page"
        >
            {/* Head */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-bold">{bookList.title}</h2>
                    <p className="text-gray-600">{bookList.description}</p>
                </div>
                <div className="flex justify-between items-center">
                    {bookList.creator && (
                        <div className="flex items-center gap-3">
                            <img
                                src={bookList.creator.avatar}
                                alt="creator avatar"
                                className="w-10 h-10 rounded-full shadow"
                            />
                            <p className="text-sm text-gray-700">
                                {bookList.creator.name}
                            </p>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <IconButton
                            aria-label={t("accessibility.favorite")}
                            size="small"
                        >
                            <FavoriteBorder fontSize="small" />
                        </IconButton>
                        <IconButton
                            aria-label={t("accessibility.comments")}
                            size="small"
                            onClick={handleGoToComments}
                        >
                            <Comment fontSize="small" />
                        </IconButton>
                        <IconButton
                            aria-label={t("accessibility.collection")}
                            size="small"
                        >
                            <Add fontSize="small" />
                        </IconButton>
                    </div>
                </div>
            </div>

            {/* Book List */}
            <div className="grid grid-cols-1 gap-4 mt-6">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {bookList.books.map((book: any, idx: number) => (
                    <div key={idx} className="flex items-start space-x-4">
                        <img
                            src={book.cover}
                            alt="book cover"
                            className="w-24 h-32 object-cover rounded-md shadow-md"
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-semibold">
                                    {book.name}
                                </h3>
                                {/* 评分展示 */}
                                <span className="text-lg text-yellow-500">
                                    {book.rating}
                                </span>
                            </div>
                            <div>
                                <CollapsibleText.Container
                                    content={book.review}
                                    threshold={600}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Likes & Comments */}
            <div className="text-sm mt-5 text-gray-700">
                <span>{bookList.likes}</span> <span className="ml-1">likes</span>
                <span className="ml-4">{bookList.commentsNumber}</span> <span className="ml-1">comments</span>
            </div>

            {/* 评论区 */}
            <div id="BLCOMMENT" ref={commentRef} className="mt-5">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <AccentBarContainer />
                        <p className="text-2xl font-bold">评论</p>
                    </div>

                    <IconButton
                        size="large"
                        sx={{ fontSize: "1.5rem" }}
                        onClick={handleReply}
                    >
                        <ChatBubbleOutline fontSize="inherit" />
                    </IconButton>
                </div>

                <TreeReplyComponents bookListId={readlistId || ""} />
                {/* 供评论区占位符 */}
                <div className="mb-[200px]" />
            </div>
        </div>
    );
};

export default ReadListPage;
