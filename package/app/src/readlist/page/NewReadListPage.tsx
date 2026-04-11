import { Button } from "@mui/material";
import { useCreateShelfMutation } from "@rezics/api/shelf/shelf";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReadListEditor } from "./ReadListEditPage";

/**
 * NewReadListPage - now uses Shelf API instead of Readlist API.
 * Creates a Shelf with translations instead of top-level title/content.
 */
export const NewReadListPage: React.FC = () => {
  const navigate = useNavigate();
  const [readlistData, setReadlistData] = useState<any>({
    books: [],
    reviews: [],
  });
  const createShelfMutation = useCreateShelfMutation({
    onSuccess: (data) => {
      navigate({ to: `/readlist/${data.unitId}` });
    },
    onError: (error) => {
      console.error("create shelf failed", error);
    },
  });

  const { t } = useTranslation();

  function handleSubmit() {
    // MOCK: map old readlist fields to new shelf create input
    createShelfMutation.mutate({
      kindKey: 'collection',
      translations: [
        {
          language: 'zh-CN',
          title: readlistData.title ?? '',
          description: readlistData.content ?? '',
        },
      ],
    });
  }

  const NewReadListHeader = (
    <div className="mb-4">
      <div className="flex items-center">
        <div className="text-2xl font-bold">
          {t("page.readlist.new_readlist")}
        </div>
        <div className="ml-auto">
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            {t("page.readlist.new_readlist")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ReadListEditor
      readlistData={readlistData}
      setReadlistData={setReadlistData}
      header={NewReadListHeader}
    />
  );
};

export default NewReadListPage;
