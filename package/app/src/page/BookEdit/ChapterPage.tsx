import { useEffect, useState } from "react";
import { Button, TextField } from "@mui/material";
import EasyEditor from "@/component/Form/EasyEditor";

import { useParams } from "wouter";
import { useQuery } from "urql";
import { ChapterContentQuery, ChapterContent } from "@/api/bookContent";

export const BookEditChapterPage: React.FC = () => {

    const { chapterId } = useParams();
    const [{ data, fetching, error }] = useQuery<ChapterContent>({
        query: ChapterContentQuery,
        variables: { chapterId: chapterId },
    });

    const [content, setContent] = useState("");
    const [title, setTitle] = useState("");
    
    useEffect(() => {
        if (data) {
            console.log(data);
            setContent(data.content);
            setTitle(data.chapterName);
        }
    }, [data]);

    const handleSubmit = () => {
        if (!content.trim()) {
            alert("内容不能为空！");
            return;
        }

        // TODO: 替换为 API 提交逻辑
        console.log("提交的内容：", content, "标题：", title);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">编辑章节</h1>
                <Button onClick={handleSubmit}>提交</Button>
            </div>

            <div className="rounded-lg border border-gray-200 shadow-sm p-4 bg-white">
                <div className="mb-4">
                    <TextField
                        id="filled-textarea"
                        label="章节标题"
                        placeholder="请输入章节标题"
                        multiline
                        variant="filled"
                        className="w-full"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <EasyEditor value={content} onChange={setContent} />
            </div>
        </div>
    );
};
