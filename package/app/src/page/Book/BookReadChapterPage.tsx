import { useParams } from "wouter";
import { useQuery } from "urql";
import { ChapterContentQuery, ChapterContent } from "@/graphql/BookContent";
import { Typography } from "@mui/material";

export const BookReadChapterPage: React.FC = () => {
    const { chapterId } = useParams();
    const [{ data, fetching, error }] = useQuery<ChapterContent>({
        query: ChapterContentQuery,
        variables: { chapterId: chapterId },
    });

    console.log(data?.content);

    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;
    return (
        <div>
            <h1>BookReadChapterPage</h1>
            <div className="whitespace-break-spaces">
                {data?.content}
            </div>
        </div>
    );
};
