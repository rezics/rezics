import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { AccentBarWithText } from "../Common/AccentBar";
import { Link } from "@mui/material";
import { ReadlistList } from "@component/ReadList/ReadlistList";

import { useQuery } from "urql";
import { bookListsQuery } from "@/api/readlist";

export function ReadlistByBookPreview({ title, bookId }: { title: string; bookId?: string }) {
    // TODO: 获取包含该书的书单数据

    const [{ data, fetching, error }] = useQuery({
        query: bookListsQuery,
        variables: { bookId: bookId },
    });

    if (fetching) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error: {JSON.stringify(error)}</div>;
    }

    return (
        <div>
            <Link href={`/book/${bookId}/lists`} className="flex mb-4">
                <ArrowForwardIcon.Container size={16}>
                    <AccentBarWithText.Container text={`包含 ${title} 的书单`} />
                </ArrowForwardIcon.Container>
            </Link>
            <ReadlistList booklists={data?.bookLists || []} />
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
