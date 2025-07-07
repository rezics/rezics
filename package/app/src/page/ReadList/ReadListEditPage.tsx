import { Button, TextField } from "@mui/material";
import { useState } from "react";

export function BookListEditPage() {
    const [bookReviewSearch, setBookReviewSearch] = useState("");
    return (
        <div className="w-11/12 mx-auto">
            <div>BookListEditPage</div>
            <div>
                <TextField
                    id="standard-basic"
                    label="书评搜素"
                    variant="standard"
                    value={bookReviewSearch}
                    onChange={(e) => {
                        setBookReviewSearch(e.target.value);
                    }}
                />
                <Button
                    variant="contained"
                    onClick={() => {
                        console.log(bookReviewSearch);
                    }}
                >
                    {/* 支持黏贴连接，ID，名称搜索 */}
                    Search
                </Button>
                {/* TODO 展示搜素哦结果列表，支持选择添加 */}
                <Button
                    variant="contained"
                    onClick={() => {
                        console.log(bookReviewSearch);
                    }}
                >
                    Add
                </Button>
            </div>
            <div>{/* TODO 列出添加的所有书评Card，并支持排序，删除，以及快捷编辑具体书评 */}</div>
        </div>
    );
}
