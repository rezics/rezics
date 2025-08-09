import { Button } from "@mui/material";
import EasyEditor from "../Form/EasyEditor";
import { ScoreForm } from "../Form/ScoreForm";
import { useState } from "react";

export function ReviewEdit() {
    const [score, setScore] = useState(0);
    const [activeScore, setActiveScore] = useState(0);
    const [content, setContent] = useState("");
    const onContentChange = (value: string) => {
        setContent(value);
    };
    const onSubmit = () => {
        console.log("submit", content, score);
    };
    return (
        <div>
            <div className="flex w-full justify-between">
                <div className="flex gap-2 items-center">
                    <span className="text-lg font-bold">Your Rating</span>
                    <ScoreForm.Edit
                        onScoreChange={setScore}
                        onChangeActive={setActiveScore}
                        max={10}
                        precision={1}
                    />
                    <div className="text-lg font-bold">
                        {activeScore != -1 ? activeScore : score}
                    </div>
                </div>
                <Button variant="contained" color="primary" onClick={onSubmit}>
                    Submit ALL
                </Button>
            </div>
            <div className="mt-4">
                <EasyEditor value={content} onChange={onContentChange} />
            </div>
        </div>
    );
}
