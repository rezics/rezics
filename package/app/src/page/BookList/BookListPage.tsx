import React, { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "urql";
import { GET_BOOKLIST } from "@/graphql/bookList";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { AccentBar } from "@component/Common/AccentBar";
import { ReplyComponents } from "@component/Form/ReplyComponents";
import { IconButton } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import CommentIcon from "@mui/icons-material/Comment";
import AddIcon from "@mui/icons-material/Add";

export const BookListPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [{ data, fetching }] = useQuery({
        query: GET_BOOKLIST,
        variables: { id },
    });

    const commentRef = useRef<HTMLDivElement>(null);

    if (fetching) {
        return <div className="text-center py-10">加载中...</div>;
    }

    const bookList = data?.bookList;
    if (!bookList) {
        return <div className="text-center py-10 text-red-500">未找到书单</div>;
    }

    const handleGoToComments = () => {
        commentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="w-full max-w-4xl mt-[60px] mx-auto" data-testid="booklist-page">
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
                            <p className="text-sm text-gray-700">{bookList.creator.name}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <IconButton aria-label="Favorite" size="small">
                            <FavoriteBorderIcon fontSize="small" />
                        </IconButton>
                        <IconButton aria-label="Comments" size="small" onClick={handleGoToComments}>
                            <CommentIcon fontSize="small" />
                        </IconButton>
                        <IconButton aria-label="Collection" size="small">
                            <AddIcon fontSize="small" />
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
                                <h3 className="text-xl font-semibold">{book.title}</h3>
                                {/* 评分展示 */}
                                <span className="text-lg text-yellow-500">{book.rating}</span>
                            </div>
                            <div>
                                <CollapsibleText content={book.review} threshold={600} />
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
            <div id="BLCOMMENT" ref={commentRef}>
                <h2 className="text-xl font-semibold mt-6 mb-2 flex items-center">
                    <AccentBar height={20} />
                    <span className="align-middle ml-2">书单评论</span>
                </h2>
                <ReplyComponents bookListId={id} />
            </div>
        </div>
    );
};

export default BookListPage;
