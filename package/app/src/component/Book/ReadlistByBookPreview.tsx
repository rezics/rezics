import { Box, Link } from "@mui/material";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { AccentBarWithText } from "../Common/AccentBar";
import { ReadlistByBook } from "@/page/ReadList/ReadListsByBookPage";

// * ReadlistByBook may expose the data-fetching function. This component is only responsible for displaying a few entries as a preview.
function ReadlistByBookPreview({ bookId, title }: { bookId: string, title: string }) {
    return (
        <Box>
            <Link href={`/book/${bookId}/lists`} className="flex mb-4">
                <ArrowForwardIcon size={16}>
                    <AccentBarWithText text={`包含 ${title} 的书单`} />
                </ArrowForwardIcon>
            </Link>
            <ReadlistByBook />
        </Box>
    );
}

export default ReadlistByBookPreview;
