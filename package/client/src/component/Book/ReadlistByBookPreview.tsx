import { apiPost } from "@/api/swr.ts";
import { ReadlistList } from "@component/ReadList/ReadlistList.tsx";
import useSWR from "swr";
import { Link as _Link } from "wouter";
import { AccentBarWithTextContainer } from "../Common/AccentBar.tsx";
import { ArrowForwardIconContainer } from "../Common/ArrowForwardIcon.tsx";

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
            <ArrowForwardIconContainer
                size={16}
                to={`/readlist/book/${bookId}`}
            >
                <AccentBarWithTextContainer text={`包含 ${title} 的书单`} />
            </ArrowForwardIconContainer>
            <div className="mb-4" />
            <ReadlistList booklists={data?.items || []} />
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
