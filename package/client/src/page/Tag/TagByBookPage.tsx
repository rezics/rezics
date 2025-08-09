import tsr from "@/api/tsr";
import { AccentBarWithText } from "@/component/Common/AccentBar";

interface TagByBookPageProps {
    bookId: string;
}

export function TagByBookPage({ bookId }: TagByBookPageProps) {
    const { data } = tsr.book.get.useQuery({
        queryKey: ["book", bookId],
        queryData: {
            params: {
                bookId: bookId!,
            },
        },
    });

    return (
        <div className="w-11/12 mx-auto mt-10">
            <AccentBarWithText.Show text={`${data?.body.title} 的标签`} />
        </div>
    );
}
