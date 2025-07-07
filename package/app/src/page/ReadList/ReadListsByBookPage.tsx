import { ReadlistList } from "@/component/ReadList/ReadlistList";
import { useQuery } from "urql";
import { bookListsQuery, BookList } from "@/api/readlist";
import React, { useState } from "react";

export function ReadlistByBook() {
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
        <ReadlistList booklists={booklists} />
    )
}