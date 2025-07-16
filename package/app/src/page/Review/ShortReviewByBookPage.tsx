import { useParams } from "wouter";
import { useQuery } from "urql";
import { GET_BOOK_SHORT_REVIEWS } from "@/api/bookReviews";
import { ShortReviewList } from "@/component/Review/ShortReviewList";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import EasyEditor from "@/component/Form/EasyEditor";
import { useState } from "react";
import { ScoreForm } from "@/component/Form/scoreForm";
import { Button } from "@mui/material";

export function ShortReviewByBookPage() {
    const { bookId } = useParams();
    const [result] = useQuery({
        query: GET_BOOK_SHORT_REVIEWS,
        variables: { bookId },
    });
    const [content, setContent] = useState("");
    const [score, setScore] = useState(0);
    const [activeScore, setActiveScore] = useState(0);
    const onContentChange = (value: string) => {
        setContent(value);
    };
    const onSubmit = () => {
        console.log("submit", content, score);
    };

    return (
        <div className="w-10/12 mx-auto mt-10">
            <AccentBarWithText.Show text="短评" />
            <div className="mt-4">
                <div className="flex w-full justify-between">
                    <div className="flex gap-2 items-center">
                        <span className="text-lg font-bold">Your Rating</span>
                        <ScoreForm.Edit onScoreChange={setScore} onChangeActive={setActiveScore} max={10} precision={1} />
                        <div className="text-lg font-bold">{activeScore != -1 ? activeScore : score}</div>
                    </div>
                    <Button variant="contained" color="primary" onClick={onSubmit}>
                        Submit ALL
                    </Button>
                </div>
                <div className="mt-4">
                    <EasyEditor value={content} onChange={onContentChange} />
                </div>
                <ShortReviewList.Show reviews={result.data?.bookShortReviews ?? []} />
            </div>
        </div>
    );
}
