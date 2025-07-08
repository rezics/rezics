import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { AccentBarWithText } from "../Common/AccentBar";
import { Link } from "@mui/material";

export function ReadlistByBookPreview({ title, bookId }: { title: string; bookId?: string }) {
    // TODO: 获取包含该书的书单数据

    return (
        <div>
            <Link href={`/book/${bookId}/lists`} className="flex mb-4">
                <ArrowForwardIcon.Container size={16}>
                    <AccentBarWithText.Container text={`包含 ${title} 的书单`} />
                </ArrowForwardIcon.Container>
            </Link>
            {/* 此处应该显示书单列表 */}
        </div>
    );
}
