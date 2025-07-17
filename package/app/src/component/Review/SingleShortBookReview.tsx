import React from "react";
import { Tooltip } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { BookReview } from "@/api/bookReviews";
// import { CollapsibleText } from "../Common/CollapsibleText";
import { CollapsibleByLineText } from "../Common/CollapsibleByLineText";

export namespace SingleShortBookReview {
    export type Show = {
        review: BookReview & {
            likes?: number;
            dislikes?: number;
            funny?: number;
            replies?: number;
        };
        onLike?: (reviewId: string) => void;
        onDislike?: (reviewId: string) => void;
    };

    export const Show: React.FC<Show> = ({ review, onLike, onDislike }) => {
        const handleLike = () => {
            onLike?.(review.id);
        };

        const handleDislike = () => {
            onDislike?.(review.id);
        };

        const isRecommended = review.rating >= 4;

        return (
            <div className="py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                    <img
                        src={review.user.avatar}
                        alt={review.user.name}
                        className="w-10 h-10 rounded-md object-cover mt-2"
                    />

                    <div className="flex-1 flex flex-col gap-2">
                        {/* Row 1: User Info and Rating */}
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{review.user.name}</span>
                            <Tooltip title="阅读完整评测" placement="top-start">
                                <div className="flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-1 rounded-md">
                                    {isRecommended ? (
                                        <ThumbUpIcon fontSize="small" className="text-blue-500" />
                                    ) : (
                                        <ThumbDownIcon fontSize="small" className="text-gray-500" />
                                    )}
                                    <span className="text-xs">
                                        {review.rating.toFixed(1)}/5.0 · {review.createdAt}
                                    </span>
                                </div>
                            </Tooltip>
                        </div>

                        {/* Row 2: Review Content */}
                        <div>
                            {/* <p className="text-sm !line-clamp-4 mt-1">{review.content}</p> */}
                            <CollapsibleByLineText.Container
                                content={review.content}
                                maxLines={4}
                            />
                        </div>

                        {/* Row 3: Reactions */}
                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                                <div className="flex items-center space-x-1">
                                    <Tooltip title="有帮助" placement="bottom">
                                        <button
                                            onClick={handleLike}
                                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <ThumbUpIcon style={{ fontSize: "1rem" }} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="无帮助" placement="bottom">
                                        <button
                                            onClick={handleDislike}
                                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <ThumbDownIcon style={{ fontSize: "1rem" }} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="欢乐" placement="bottom">
                                        <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                            <SentimentSatisfiedAltIcon style={{ fontSize: "1rem" }} />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="颁奖" placement="bottom">
                                        <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                            <EmojiEventsIcon style={{ fontSize: "1rem" }} />
                                        </button>
                                    </Tooltip>
                                </div>
                                <div className="ml-4 text-xs flex items-center gap-2">
                                    <span>{review.likes ?? 0} 人支持</span>
                                    <span>{review.funny ?? 0} 人觉得这篇评测很欢乐</span>
                                </div>
                                {/* TODO Add a new line to show Awards or don't show awards for short reviews */}
                            </div>
                            <Tooltip title="查看回复" placement="bottom">
                                <div className="flex items-center gap-1 cursor-pointer hover:text-blue-500">
                                    <ChatBubbleOutlineIcon style={{ fontSize: "1rem" }} />
                                    <span className="text-xs">{review.replies ?? 0} </span>
                                </div>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
