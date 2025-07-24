import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { AccentBarWithText } from "../Common/AccentBar";
import { Link } from "wouter";
import { ReadlistList } from "@component/ReadList/ReadlistList";
import { tsr } from "@/api/tsr";

export function ReadlistByBookPreview({ title, bookId }: { title: string; bookId?: string }) {
    // TODO: 获取包含该书的书单数据

    const { data, isLoading, error } = tsr.readlist.listByBook.useQuery({
        queryKey: ["readlistByBook", bookId],
        queryData: {
            params: {
                bookId: bookId || "",
            },
            query: {
                page: 1,
                limit: 10,
            },
        },
    });

    if (isLoading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error: {JSON.stringify(error)}</div>;
    }

    return (
        <div>
            <ArrowForwardIcon.Container size={16} to={`/readlist/book/${bookId}`}>
                <AccentBarWithText.Container text={`包含 ${title} 的书单`} />
            </ArrowForwardIcon.Container>
            <div className="mb-4" />
            <ReadlistList booklists={data?.body?.items || []} />
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
