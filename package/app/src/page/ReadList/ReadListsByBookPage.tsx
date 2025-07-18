import { ReadlistList } from "@/component/ReadList/ReadlistList";
import { useQuery } from "urql";
import { bookListsQuery, BookList } from "@/api/readlist";
import React, { useState } from "react";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { useTranslation } from "react-i18next";

export function ReadlistByBookPage() {
    const { t } = useTranslation();
    const [booklists, setBooklists] = useState<BookList[]>([]);
    const [result] = useQuery({
        query: bookListsQuery,
    });

    React.useEffect(() => {
        if (result.data?.bookLists) {
            setBooklists(result.data.bookLists);
        }
    }, [result.data]);
    return (
        <div className="w-11/12 mx-auto mt-10">
            <AccentBarWithText.Show text={`${t("pages.book_collection_list_page")}`} />
            <div className="mt-4">
                <ReadlistList booklists={booklists} />
            </div>
        </div>
    );
}
