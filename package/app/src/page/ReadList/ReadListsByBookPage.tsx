import useRpcQuery from "@/api/swr-query/tsrTypeBuild";
import { AccentBarWithTextShow } from "@/component/Common/AccentBar.tsx";
import { ReadlistList } from "@/component/ReadList/ReadlistList.tsx";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
// import { ReadList } from "contract";

type ReadList = any;

export function ReadlistByBookPage() {
  const { t } = useTranslation();
  const bookId = "0";
  const [booklists, setBooklists] = useState<ReadList[]>([]);
  const createReadlistListByBookInput = {
    operation: "readlist.listByBook",
    parameter: {
      bookId: bookId,
    },
  };
  const { data, isLoading, error } = useRpcQuery<any>(createReadlistListByBookInput);

  React.useEffect(() => {
    if (data?.items) {
      setBooklists(data.items);
    }
  }, [data]);
  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow
        text={`${t("pages.book_collection_list_page")}`}
      />
      <div className="mt-4">
        <ReadlistList booklists={booklists} />
      </div>
    </div>
  );
}
