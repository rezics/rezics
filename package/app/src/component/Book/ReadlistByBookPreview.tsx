import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { AccentBarWithText } from "../Common/AccentBar";
import { Link } from "wouter";
import { ReadlistList } from "@component/ReadList/ReadlistList";
import { tsr } from "@/api/tsr";

export function ReadlistByBookPreview({ title, bookId }: { title: string; bookId?: string }) {
    // TODO: 获取包含该书的书单数据

    const { data, isLoading, error } = tsr.readlists.listByBook.useQuery({
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
            <Link href={`/readlist/book/${bookId}`} className="flex mb-4">
                <ArrowForwardIcon.Container size={16}>
                    <AccentBarWithText.Container text={`包含 ${title} 的书单`} />
                </ArrowForwardIcon.Container>
            </Link>
            <ReadlistList booklists={data?.body?.items || []} />
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
