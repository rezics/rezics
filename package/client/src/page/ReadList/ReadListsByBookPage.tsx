import { ReadlistList } from "@/component/ReadList/ReadlistList";
import React, { useState } from "react";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { useTranslation } from "react-i18next";
import tsr from "@/api/tsr";
import { ReadList } from "contract"

export function ReadlistByBookPage() {
    const { t } = useTranslation();
    const bookId = "0";
    const [booklists, setBooklists] = useState<ReadList[]>([]);
    const { data, isLoading, error } = tsr.readlist.listByBook.useQuery({
        queryKey: ["readlist", bookId],
        queryData: {
            params: {
                bookId: bookId,
            },
            query: {
                page: 1,
                limit: 10,
            },
        },
    });

    React.useEffect(() => {
        if (data?.body?.items) {
            setBooklists(data.body.items);
        }
    }, [data]);
    return (
        <div className="w-11/12 mx-auto mt-10">
            <AccentBarWithText.Show text={`${t("pages.book_collection_list_page")}`} />
            <div className="mt-4">
                <ReadlistList booklists={booklists} />
            </div>
        </div>
    );
}
