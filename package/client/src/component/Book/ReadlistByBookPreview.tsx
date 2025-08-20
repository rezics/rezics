import { apiPost } from "@/api/swr.ts";
import { ReadlistList } from "@component/ReadList/ReadlistList.tsx";
import useSWR from "swr";
import { Link as _Link } from "wouter";
import { AccentBarWithText } from "../Common/AccentBar.tsx";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon.tsx";

export function ReadlistByBookPreview(
    { title, bookId }: { title: string; bookId?: string },
) {
    // TODO: 获取包含该书的书单数据

    const createReadlistListInput = {
        operation: "readlist.list",
        parameter: {
            bookId: bookId || "",
        },
    };
    const { data, isLoading, error } = useSWR(createReadlistListInput, apiPost);

    if (isLoading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error: {JSON.stringify(error)}</div>;
    }

    return (
        <div>
            <ArrowForwardIcon.Container
                size={16}
                to={`/readlist/book/${bookId}`}
            >
                <AccentBarWithText.Container text={`包含 ${title} 的书单`} />
            </ArrowForwardIcon.Container>
            <div className="mb-4" />
            <ReadlistList booklists={data?.items || []} />
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
